/**
 * dsh-token-dashboard — Host half.
 *
 * Reads every local session through the official SessionPersistence service,
 * folds provider-reported usage with token-meter's published semantics, keeps
 * a revision-keyed in-memory cache, and serves the dashboard over one
 * authenticated, read-only same-origin route.
 *
 * The plugin never writes session logs, never alters a model request, and
 * holds no second ledger: the durable logs remain the only source of truth.
 */

import { TokenAggregator } from './aggregate.js'
import { registerDashboardRoutes } from './server.js'
import { createDshSource } from './source.js'
import type {
  ConnectionLike,
  HostServiceAccess,
  LiveSessionLike,
  RawSessionEvent,
  SessionPersistenceLike,
  SessionQueryLike,
  SessionsLike,
  WebServerLike,
  WorkspaceRegistryLike,
} from './types.js'

export const name = 'dsh-token-dashboard'

/** The durable session store is the one hard dependency. */
export const inject = ['sessionPersistence']

/** Minimal Cordis Context surface used by this plugin. */
interface HostContextLike {
  effect(callback: () => void | (() => void), label?: string): unknown
  on(event: string, listener: (...args: any[]) => void): unknown
  inject(services: readonly string[], callback: (ctx: HostContextLike) => void): unknown
  get(name: string): unknown
}

/** Register the dashboard against one Host context. */
export function apply(ctx: HostContextLike): void {
  const access: HostServiceAccess = {
    persistence: () => ctx.get('sessionPersistence') as SessionPersistenceLike | undefined,
    sessions: () => ctx.get('sessions') as SessionsLike | undefined,
    sessionQuery: () => ctx.get('sessionQuery') as SessionQueryLike | undefined,
    workspaces: () => ctx.get('workspaceRegistry') as WorkspaceRegistryLike | undefined,
  }

  const source = createDshSource(access)
  const aggregator = new TokenAggregator(source, { concurrency: 3 })
  wireLiveEvents(ctx, aggregator)
  wireRoutes(ctx, aggregator, source)
}

/** Fold live events without rescanning history; resync only on a gap. */
function wireLiveEvents(ctx: HostContextLike, aggregator: TokenAggregator): void {
  ctx.effect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefresh = (): void => {
      if (aggregator.isInitialized === false) return
      if (timer !== null) return
      timer = setTimeout(() => {
        timer = null
        void aggregator.refresh().catch(error => {
          warn('live resync failed', error)
        })
      }, 700)
      const handle = timer as unknown as { unref?: () => void }
      handle.unref?.()
    }

    const disposers: Array<() => void> = []
    const remember = (value: unknown): void => {
      if (typeof value === 'function') disposers.push(value as () => void)
    }

    remember(ctx.on('session/event', (session: LiveSessionLike, event: RawSessionEvent) => {
      // A passive observer must never throw into the Session append path.
      try {
        if (aggregator.isInitialized === false) return
        const id = session?.id
        if (typeof id !== 'string' || id === '') return
        if (!aggregator.applyLiveEvent(id, event)) scheduleRefresh()
      } catch (error) {
        warn('live fold failed', error)
        scheduleRefresh()
      }
    }))

    remember(ctx.on('session/created', () => {
      scheduleRefresh()
    }))

    remember(ctx.on('session/disposed', () => {
      scheduleRefresh()
    }))

    return () => {
      if (timer !== null) clearTimeout(timer)
      for (const dispose of disposers) {
        try {
          dispose()
        } catch {
          // A listener already removed by its owning fiber is not an error.
        }
      }
    }
  }, 'dsh-token-dashboard: live usage')
}

/** Register the read-only HTTP surface when the deployment serves a web UI. */
function wireRoutes(
  ctx: HostContextLike,
  aggregator: TokenAggregator,
  source: ReturnType<typeof createDshSource>,
): void {
  ctx.inject(['webServer'], (webCtx: HostContextLike) => {
    const server = webCtx.get('webServer') as WebServerLike | undefined
    if (server === undefined) return
    webCtx.effect(() => registerDashboardRoutes({
      server,
      aggregator,
      source,
      connection: () => ctx.get('connection') as ConnectionLike | undefined,
    }), 'dsh-token-dashboard: dashboard routes')
  })
}

function warn(message: string, error: unknown): void {
  console.warn(`[dsh-token-dashboard] ${message}: ${errorName(error)}`)
}

function errorName(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? `${error.name}:${code}` : error.name
  }
  return 'UnknownError'
}
