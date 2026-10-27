import test from 'node:test'
import assert from 'node:assert/strict'

import { TokenAggregator } from '../src/host/aggregate.js'
import { registerDashboardRoutes } from '../src/host/server.js'
import type { AggregatorSource } from '../src/host/source.js'
import type {
  HttpRequestLike,
  HttpResponseLike,
  RawSessionEvent,
  WebServerLike,
} from '../src/host/types.js'
import { T0, assistantMessage, header, requestHeader, usage } from './helpers.js'

const sessionHeader = header({ id: 'session-a' })
const events: RawSessionEvent[] = [
  requestHeader(0, 'provider-a', 'model-a'),
  assistantMessage(1, 1, 1, {
    usage: usage({ inputTokens: 30, cacheReadTokens: 10, cacheWriteTokens: 5, outputTokens: 7 }),
  }),
]

function createSource(projectUsage?: AggregatorSource['projectUsage']): AggregatorSource {
  return {
    list: async () => [{
      id: 'session-a',
      header: sessionHeader,
      live: false,
      seq: events.length,
      eventCount: events.length,
      inheritedEventCount: 0,
      revision: 'rev-1',
    }],
    read: async () => ({ header: sessionHeader, inheritedEventCount: 0, events }),
    projectLabel: () => 'Project A',
    ...(projectUsage === undefined ? {} : { projectUsage }),
  }
}

class FakeServer implements WebServerLike {
  route: Parameters<WebServerLike['register']>[0] | null = null

  register(route: Parameters<WebServerLike['register']>[0]): () => void {
    this.route = route
    return () => { this.route = null }
  }
}

class FakeResponse implements HttpResponseLike {
  statusCode = 200
  headersSent = false
  readonly headers: Record<string, string> = {}
  body = ''
  ended = false

  setHeader(name: string, value: string): void {
    this.headers[name.toLowerCase()] = value
  }

  writeHead(status: number, headers?: Record<string, string>): this {
    this.statusCode = status
    this.headersSent = true
    for (const [name, value] of Object.entries(headers ?? {})) this.headers[name.toLowerCase()] = value
    return this
  }

  end(body?: string): void {
    if (body !== undefined) this.body += body
    this.ended = true
  }
}

function request(url: string, method = 'GET', headers: Record<string, string> = {}): HttpRequestLike {
  return { method, url, headers }
}

async function call(
  server: FakeServer,
  req: HttpRequestLike,
  connection?: () => { requestRejection?: (request: unknown) => number | undefined } | undefined,
): Promise<FakeResponse> {
  assert.ok(server.route)
  const res = new FakeResponse()
  await server.route.handler(req, res)
  return res
}

test('stats returns the aggregated payload with an ETag and no event text', async () => {
  const source = createSource()
  const aggregator = new TokenAggregator(source, { now: () => T0 + 1_000 })
  const server = new FakeServer()
  const dispose = registerDashboardRoutes({ server, aggregator, source })
  assert.equal(server.route?.kind, 'prefix')
  assert.equal(server.route?.path, '/dsh-token-dashboard')

  const res = await call(server, request('/dsh-token-dashboard/stats'))
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8')
  assert.match(res.headers.etag ?? '', /^W\/"tdb-1-/)
  const payload = JSON.parse(res.body) as Record<string, unknown>
  assert.equal(payload.apiVersion, 1)
  const totals = payload.totals as Record<string, number>
  assert.equal(totals.uncachedInputTokens, 30)
  assert.equal(totals.cacheReadTokens, 10)
  assert.equal(totals.cacheWriteTokens, 5)
  assert.equal(totals.outputTokens, 7)
  assert.equal(res.body.includes('assistant text'), false)
  assert.equal(res.body.includes('prompt'), false)
  dispose()
  assert.equal(server.route, null)
})

test('a matching If-None-Match answers 304 with no body', async () => {
  const source = createSource()
  const aggregator = new TokenAggregator(source, { now: () => T0 + 1_000 })
  const server = new FakeServer()
  registerDashboardRoutes({ server, aggregator, source })

  const first = await call(server, request('/dsh-token-dashboard/stats'))
  const etag = first.headers.etag
  assert.ok(etag)
  const second = await call(server, request('/dsh-token-dashboard/stats', 'GET', { 'if-none-match': etag }))
  assert.equal(second.statusCode, 304)
  assert.equal(second.body, '')
})

test('refresh=1 reconciles revisions while the cached read does not', async () => {
  let lists = 0
  const source: AggregatorSource = {
    ...createSource(),
    list: async () => {
      lists += 1
      return [{
        id: 'session-a',
        header: sessionHeader,
        live: false,
        seq: events.length,
        eventCount: events.length,
        inheritedEventCount: 0,
        revision: 'rev-1',
      }]
    },
  }
  const aggregator = new TokenAggregator(source, { now: () => T0 + 1_000 })
  const server = new FakeServer()
  registerDashboardRoutes({ server, aggregator, source })

  await call(server, request('/dsh-token-dashboard/stats'))
  assert.equal(lists, 1)
  await call(server, request('/dsh-token-dashboard/stats'))
  assert.equal(lists, 1)
  await call(server, request('/dsh-token-dashboard/stats?refresh=1'))
  assert.equal(lists, 2)
})

test('the host connection gate is honored before any data is read', async () => {
  let listed = false
  const source: AggregatorSource = {
    ...createSource(),
    list: async () => {
      listed = true
      return []
    },
  }
  const aggregator = new TokenAggregator(source, { now: () => T0 })
  const server = new FakeServer()
  registerDashboardRoutes({
    server,
    aggregator,
    source,
    connection: () => ({ requestRejection: () => 401 }),
  })

  const res = await call(server, request('/dsh-token-dashboard/stats'))
  assert.equal(res.statusCode, 401)
  assert.equal(res.body, '')
  assert.equal(listed, false)
})

test('unknown paths and non-GET methods are refused', async () => {
  const source = createSource()
  const aggregator = new TokenAggregator(source, { now: () => T0 })
  const server = new FakeServer()
  registerDashboardRoutes({ server, aggregator, source })

  const missing = await call(server, request('/dsh-token-dashboard/nope'))
  assert.equal(missing.statusCode, 404)

  const post = await call(server, request('/dsh-token-dashboard/stats', 'POST'))
  assert.equal(post.statusCode, 405)
  assert.equal(post.headers.allow, 'GET, HEAD')
})

test('verify compares the fold against the official tokenUsage projection', async () => {
  const official = {
    uncachedInputTokens: 30,
    cacheReadTokens: 10,
    cacheWriteTokens: 5,
    outputTokens: 7,
  }
  const source = createSource(async () => official)
  const aggregator = new TokenAggregator(source, { now: () => T0 })
  const server = new FakeServer()
  registerDashboardRoutes({ server, aggregator, source })

  const res = await call(server, request('/dsh-token-dashboard/verify'))
  assert.equal(res.statusCode, 200)
  const report = JSON.parse(res.body) as Record<string, unknown>
  assert.equal(report.checked, 1)
  assert.equal(report.matched, 1)
  assert.equal(report.mismatched, 0)
  assert.equal(res.body.includes('Project A'), false)
})

test('a projection mismatch is reported without exposing session content', async () => {
  const source = createSource(async () => ({
    uncachedInputTokens: 1,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
  }))
  const aggregator = new TokenAggregator(source, { now: () => T0 })
  const server = new FakeServer()
  registerDashboardRoutes({ server, aggregator, source })

  const res = await call(server, request('/dsh-token-dashboard/verify'))
  const report = JSON.parse(res.body) as Record<string, unknown>
  assert.equal(report.mismatched, 1)
  assert.equal(res.body.includes('assistant text'), false)
})

test('a missing projection source is reported as unsupported', async () => {
  const source = createSource()
  const aggregator = new TokenAggregator(source, { now: () => T0 })
  const server = new FakeServer()
  registerDashboardRoutes({ server, aggregator, source })

  const res = await call(server, request('/dsh-token-dashboard/verify'))
  const report = JSON.parse(res.body) as Record<string, unknown>
  assert.equal(report.unsupported, 1)
  assert.equal(report.checked, 0)
})
