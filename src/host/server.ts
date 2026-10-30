/**
 * HTTP surface for the dashboard.
 *
 * One same-origin, read-only prefix route:
 *   GET /dsh-token-dashboard/stats    dashboard payload (ETag, ?refresh=1)
 *   GET /dsh-token-dashboard/verify   fold vs official tokenUsage projection
 *   GET /dsh-token-dashboard/prices   optional online list prices (explicit refresh)
 *   GET /dsh-token-dashboard/health   liveness and revision
 *
 * The route reuses the Host Connection gate when the deployment publishes one,
 * so a remote or logged-out peer is refused exactly like the Host API.
 */

import { API_PREFIX, API_VERSION } from '../shared/types.js'
import type { StatsPayload } from '../shared/types.js'
import type { TokenAggregator } from './aggregate.js'
import type { AggregatorSource } from './source.js'
import type { PriceLookup } from './prices.js'
import type { ConnectionLike, HttpRequestLike, HttpResponseLike, WebServerLike } from './types.js'
import { verifyAgainstProjection } from './verify.js'

/** Dependencies for the route registration. */
export interface DashboardRoutesOptions {
  server: WebServerLike
  aggregator: TokenAggregator
  source: AggregatorSource
  connection?: () => ConnectionLike | undefined
  prices?: PriceLookup
}

/** Register the prefix route; returns its disposer. */
export function registerDashboardRoutes(options: DashboardRoutesOptions): () => void {
  return options.server.register({
    kind: 'prefix',
    path: API_PREFIX,
    handler: async (req, res) => {
      try {
        if (refusedByHost(req, res, options.connection)) return
        const url = new URL(req.url ?? '/', 'http://localhost')
        const suffix = routeSuffix(url.pathname)
        if (suffix === undefined) {
          sendError(res, 404, 'not-found', 'Unknown dashboard route.')
          return
        }
        const method = (req.method ?? 'GET').toUpperCase()
        if (method !== 'GET' && method !== 'HEAD') {
          res.setHeader('allow', 'GET, HEAD')
          sendError(res, 405, 'method-not-allowed', 'The dashboard API is read-only.')
          return
        }
        const headOnly = method === 'HEAD'

        if (suffix === '/health') {
          sendJson(res, 200, {
            ok: true,
            apiVersion: API_VERSION,
            initialized: options.aggregator.isInitialized,
            revision: options.aggregator.getRevision(),
          }, headOnly)
          return
        }

        if (suffix === '/stats') {
          if (url.searchParams.get('refresh') === '1') await options.aggregator.refresh()
          else await options.aggregator.ensure()
          const payload = options.aggregator.stats()
          const etag = `W/"tdb-${payload.apiVersion}-${payload.revision}"`
          if (matchesEtag(req, etag)) {
            res.writeHead(304, {
              etag,
              'cache-control': 'no-store',
            })
            res.end()
            return
          }
          sendJson(res, 200, payload, headOnly, { etag })
          return
        }

        if (suffix === '/prices') {
          if (options.prices === undefined) {
            sendError(res, 503, 'prices-unavailable', 'Online prices are not configured.')
            return
          }
          const rawModels = url.searchParams.get('models') ?? ''
          const models = [...new Set(rawModels
            .split(',')
            .map(model => model.trim())
            .filter(model => model !== '' && model.length <= 160))]
            .slice(0, 100)
          try {
            const payload = await options.prices.lookup(models, url.searchParams.get('refresh') === '1')
            sendJson(res, 200, payload, headOnly)
          } catch {
            sendError(res, 502, 'prices-unavailable', 'Online prices are unavailable.')
          }
          return
        }

        if (suffix === '/verify') {
          await options.aggregator.ensure()
          const limit = Number(url.searchParams.get('limit') ?? '40')
          const report = await verifyAgainstProjection(options.source, options.aggregator, limit)
          sendJson(res, 200, report, headOnly)
          return
        }

        sendError(res, 404, 'not-found', 'Unknown dashboard route.')
      } catch (error) {
        console.warn(`[dsh-token-dashboard] request failed: ${safeErrorName(error)}`)
        if (!res.headersSent) {
          sendError(res, 500, 'internal', 'The token dashboard could not read session history.')
        }
      }
    },
  })
}

function routeSuffix(pathname: string): string | undefined {
  const index = pathname.lastIndexOf(API_PREFIX)
  if (index === -1) return undefined
  if (index !== 0 && pathname[index - 1] !== '/') return undefined
  const suffix = pathname.slice(index + API_PREFIX.length)
  if (suffix === '' || suffix === '/') return '/'
  return `/${suffix.replace(/^\/+/, '').replace(/\/+$/, '')}`
}

function refusedByHost(
  req: HttpRequestLike,
  res: HttpResponseLike,
  connection: (() => ConnectionLike | undefined) | undefined,
): boolean {
  let status: number | undefined
  try {
    status = connection?.()?.requestRejection?.(req)
  } catch {
    status = 403
  }
  if (typeof status !== 'number') return false
  res.writeHead(status, { 'cache-control': 'no-store' })
  res.end()
  return true
}

function matchesEtag(req: HttpRequestLike, etag: string): boolean {
  const raw = req.headers['if-none-match']
  const value = Array.isArray(raw) ? raw.join(',') : raw
  if (typeof value !== 'string') return false
  return value.split(',').map(part => part.trim()).includes(etag)
}

function sendJson(
  res: HttpResponseLike,
  status: number,
  payload: unknown,
  headOnly = false,
  extra: Record<string, string> = {},
): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extra,
  })
  if (headOnly) res.end()
  else res.end(body)
}

function sendError(res: HttpResponseLike, status: number, code: string, message: string): void {
  sendJson(res, status, { error: { code, message } })
}

function safeErrorName(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? `${error.name}:${code}` : error.name
  }
  return 'UnknownError'
}

/** Type guard for tests: a payload carrying the required top-level fields. */
export function isStatsPayload(value: unknown): value is StatsPayload {
  if (value === null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return record.apiVersion === API_VERSION
    && typeof record.revision === 'number'
    && Array.isArray(record.days)
    && Array.isArray(record.sessionRows)
}
