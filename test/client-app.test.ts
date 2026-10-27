import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createElement as h } from 'react'

import { en } from '../src/client/locales.js'
import type { LocaleLike } from '../src/client/lib.js'
import { summarize } from '../src/shared/range.js'
import type {
  ModelUsage,
  SessionSummary,
  StatsPayload,
  UsageBucket,
} from '../src/shared/types.js'

const now = Date.UTC(2026, 0, 5, 12)
const totals = {
  uncachedInputTokens: 1_000,
  cacheReadTokens: 2_000,
  cacheWriteTokens: 400,
  outputTokens: 600,
}

const model: ModelUsage = {
  key: 'opencode-go::deepseek-v4.1-flash',
  provider: 'opencode-go',
  model: 'deepseek-v4.1-flash',
  requests: 4,
  ...totals,
}

const bucket: UsageBucket = { bucket: '2026-01-05', requests: 4, models: [model], ...totals }

const session: SessionSummary = {
  id: 'session-1234',
  title: 'Fix the parser',
  project: 'Project A',
  cwd: '/Users/example/project-a',
  modelKeys: [model.key],
  createdAt: now - 3_600_000,
  lastActivity: now - 60_000,
  live: true,
  origin: 'root',
  seeded: false,
  parentSession: null,
  agentPreset: 'default',
  totals,
  requests: 4,
  cacheHitRate: 2_000 / 3_400,
  models: [model],
  eventCount: 42,
  inheritedEventCount: 0,
  stale: false,
}

const payload: StatsPayload = {
  apiVersion: 1,
  revision: 1,
  generatedAt: now,
  timezone: 'Asia/Shanghai',
  today: '2026-01-05',
  totals,
  requests: 4,
  cacheHitRate: 2_000 / 3_400,
  sessions: { total: 1, withUsage: 1, live: 1, subagents: 0, seeded: 0 },
  models: [model],
  days: [bucket],
  hours: [{ ...bucket, bucket: '2026-01-05T10' }],
  sessionRows: [session],
  scan: {
    sessionsDiscovered: 1,
    sessionsRead: 1,
    sessionsReused: 0,
    sessionsFailed: 0,
    durationMs: 4,
    startedAt: now,
    generatedAt: now,
    partial: false,
  },
  errors: [],
}

const locale: LocaleLike = {
  register: () => () => {},
  bind: () => (key: string) => en[key] ?? key,
  subscribe: () => () => {},
  getSnapshot: () => ({ id: 'en' }),
}

test('the dashboard mounts, fetches stats, renders data, and refreshes on demand', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
  const globals = globalThis as unknown as Record<string, unknown>
  globals.window = dom.window
  globals.document = dom.window.document
  globals.localStorage = dom.window.localStorage
  globals.IS_REACT_ACT_ENVIRONMENT = true

  const calls: string[] = []
  globals.fetch = (async (input: string | URL | Request) => {
    calls.push(String(input))
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json', etag: 'W/"r1"' },
    })
  }) as unknown as typeof fetch

  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react-dom/test-utils')
  const { Dashboard } = await import('../src/client/App.js')

  const container = dom.window.document.createElement('div')
  dom.window.document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(h(Dashboard, { locale }))
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 10))
  })

  assert.equal(calls.length > 0, true)
  assert.match(calls[0] ?? '', /dsh-token-dashboard\/stats/)
  assert.match(container.textContent ?? '', /Total Tokens/)
  assert.match(container.textContent ?? '', /deepseek-v4\.1-flash/)
  assert.match(container.textContent ?? '', /Fix the parser/)
  assert.match(container.textContent ?? '', /Estimated cost/)
  assert.match(container.textContent ?? '', /Lifetime total/)

  const buttons = Array.from(container.querySelectorAll('button'))
  const refresh = buttons.find(button => (button.textContent ?? '').includes('Refresh'))
  assert.ok(refresh, 'refresh button is present')
  await act(async () => {
    refresh.click()
  })
  assert.equal(calls.some(url => url.includes('refresh=1')), true)

  await act(async () => {
    root.unmount()
  })
  container.remove()
  dom.window.close()
})
