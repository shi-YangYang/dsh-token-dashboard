/**
 * Host adapter over the official DSH services:
 * `sessionPersistence.list()/open()` for durable logs, `sessions.list()` for
 * live sessions, and `sessionQuery.observeSession()` for the diagnostic
 * cross-check against token-meter's `tokenUsage` projection.
 *
 * The adapter is read-only. It never appends, rewrites, flushes, or deletes a
 * session log.
 */

import type { TokenBuckets } from '../shared/types.js'
import type {
  HostServiceAccess,
  PersistenceSnapshot,
  RawSessionEvent,
  SessionHeaderLike,
  SessionObservationLike,
} from './types.js'

/** One session visible to the aggregator, live or persisted. */
export interface SessionDescriptor {
  id: string
  header: SessionHeaderLike
  live: boolean
  /** Live: total event count (`session.seq`). Persisted: `eventCount` when known. */
  seq: number
  revision?: string
  eventCount?: number
  inheritedEventCount: number
}

/** A full or tail read of one session log. */
export interface SessionReadResult {
  header: SessionHeaderLike
  inheritedEventCount: number
  events: readonly RawSessionEvent[]
}

/** The aggregator's data source. Tests provide a fake implementation. */
export interface AggregatorSource {
  list(): Promise<SessionDescriptor[]>
  read(descriptor: SessionDescriptor, from: number): Promise<SessionReadResult>
  projectUsage?(id: string): Promise<TokenBuckets | undefined>
  projectLabel?(cwd: string | undefined): string
}

/** Build the DSH-backed source. */
export function createDshSource(access: HostServiceAccess): AggregatorSource {
  let workspaceTitles = new Map<string, string>()

  function persistence() {
    const service = access.persistence()
    if (service === undefined) throw new Error('sessionPersistence is unavailable')
    return service
  }

  function refreshWorkspaces(): void {
    const next = new Map<string, string>()
    try {
      for (const workspace of access.workspaces()?.list() ?? []) {
        if (typeof workspace.path === 'string' && typeof workspace.title === 'string' && workspace.title.trim() !== '') {
          next.set(trimTrailingSeparators(workspace.path), workspace.title)
        }
      }
    } catch {
      // A workspace registry failure only costs nicer project labels.
    }
    workspaceTitles = next
  }

  return {
    async list() {
      refreshWorkspaces()
      const persisted = await persistence().list()
      const descriptors = new Map<string, SessionDescriptor>()

      for (const snapshot of persisted) {
        const descriptor = fromSnapshot(snapshot)
        if (descriptor !== undefined) descriptors.set(descriptor.id, descriptor)
      }

      for (const live of access.sessions()?.list() ?? []) {
        const previous = descriptors.get(live.id)
        const inherited = Math.max(0, Math.trunc(Number(live.inheritedEventCount) || 0))
        const seq = Math.max(0, Math.trunc(Number(live.seq) || 0))
        descriptors.set(live.id, {
          id: live.id,
          header: live.header,
          live: true,
          seq,
          inheritedEventCount: inherited,
          ...(previous?.revision === undefined ? {} : { revision: previous.revision }),
          ...(previous?.eventCount === undefined ? {} : { eventCount: previous.eventCount }),
        })
      }

      return [...descriptors.values()]
    },

    async read(descriptor, from) {
      if (descriptor.live) {
        const live = access.sessions()?.get(descriptor.id)
        if (live !== undefined) {
          const total = Math.max(0, Math.trunc(Number(live.seq) || 0))
          const start = Math.max(0, Math.min(Math.trunc(from), total))
          const events = start >= total ? [] : live.snapshotEvents(start, total)
          return {
            header: live.header,
            inheritedEventCount: Math.max(0, Math.trunc(Number(live.inheritedEventCount) || 0)),
            events,
          }
        }
        // The session was disposed between list() and read(): fall through to
        // the durable log, which it has already flushed by disposal.
      }

      const handle = await persistence().open(descriptor.id, 'read')
      try {
        const result = await handle.read(Math.max(0, Math.trunc(from)))
        return {
          header: handle.header,
          inheritedEventCount: Math.max(0, Math.trunc(Number(handle.inheritedEventCount) || 0)),
          events: result.events,
        }
      } finally {
        await handle.close()
      }
    },

    async projectUsage(id) {
      const query = access.sessionQuery()
      if (query === undefined) return undefined
      let observation: SessionObservationLike | undefined
      try {
        observation = await query.observeSession(id, { projectionMode: 'all' })
        const values = asRecord(asRecord(observation.projections)?.values)
        const usage = asRecord(values?.tokenUsage)
        if (usage === undefined) return undefined
        return {
          uncachedInputTokens: count(usage.uncachedInputTokens),
          cacheReadTokens: count(usage.cacheReadTokens),
          cacheWriteTokens: count(usage.cacheWriteTokens),
          outputTokens: count(usage.outputTokens),
        }
      } finally {
        disposeObservation(observation)
      }
    },

    projectLabel(cwd) {
      if (cwd === undefined || cwd.trim() === '') return ''
      const key = trimTrailingSeparators(cwd)
      return workspaceTitles.get(key) ?? baseName(key)
    },
  }
}

function fromSnapshot(snapshot: PersistenceSnapshot): SessionDescriptor | undefined {
  const header = snapshot.header
  if (header === undefined || typeof header.id !== 'string' || header.id === '') return undefined
  const eventCount = typeof snapshot.eventCount === 'number' && Number.isFinite(snapshot.eventCount)
    ? Math.max(0, Math.trunc(snapshot.eventCount))
    : 0
  return {
    id: header.id,
    header,
    live: false,
    seq: eventCount,
    eventCount,
    inheritedEventCount: 0,
    revision: typeof snapshot.revision === 'string' ? snapshot.revision : String(snapshot.revision),
  }
}

function disposeObservation(observation: SessionObservationLike | undefined): void {
  if (observation === undefined) return
  const symbol = (Symbol as unknown as { dispose?: symbol }).dispose
  if (symbol !== undefined) {
    const candidate = observation as unknown as Record<symbol, unknown>
    const disposer = candidate[symbol]
    if (typeof disposer === 'function') {
      try {
        disposer.call(observation)
      } catch {
        // The lease is best-effort released; a failed release must not mask
        // the projection result or replace the operation's own error.
      }
      return
    }
  }
  if (typeof observation.dispose === 'function') {
    try {
      observation.dispose()
    } catch {
      // See above.
    }
  }
}

function trimTrailingSeparators(value: string): string {
  const trimmed = value.replace(/[\\/]+$/, '')
  return trimmed === '' ? value : trimmed
}

function baseName(value: string): string {
  const parts = trimTrailingSeparators(value).split(/[\\/]/)
  return parts[parts.length - 1] || value
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  return Math.round(value)
}
