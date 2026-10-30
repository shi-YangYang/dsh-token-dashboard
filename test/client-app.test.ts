import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createElement as h } from 'react'

import { setLanguage } from '../src/client/language.js'
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


test('the dashboard mounts, fetches stats, renders data, and refreshes on demand', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
  const globals = globalThis as unknown as Record<string, unknown>
  globals.window = dom.window
  globals.document = dom.window.document
  globals.localStorage = dom.window.localStorage
  globals.HTMLElement = dom.window.HTMLElement
  globals.Node = dom.window.Node
  globals.IS_REACT_ACT_ENVIRONMENT = true

  const calls: string[] = []
  globals.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    calls.push(url)
    if (url.includes('/prices')) {
      return new Response(JSON.stringify({
        source: 'OpenRouter',
        fetchedAt: '2026-01-05T12:00:00.000Z',
        prices: {
          'deepseek-v4.1-flash': { currency: 'USD', input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0 },
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json', etag: 'W/"r1"' },
    })
  }) as unknown as typeof fetch

  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react-dom/test-utils')
  const { Dashboard } = await import('../src/client/App.js')
  setLanguage('en')

  const container = dom.window.document.createElement('div')
  dom.window.document.body.append(container)
  const root = createRoot(container)

  try {
  await act(async () => {
    root.render(h(Dashboard, { onOpenSession: () => {} }))
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 10))
  })

  assert.equal(calls.length > 0, true)
  assert.match(calls[0] ?? '', /dsh-token-dashboard\/stats/)
  assert.match(container.textContent ?? '', /Total tokens/)
  assert.match(container.textContent ?? '', /deepseek-v4\.1-flash/)
  assert.match(container.textContent ?? '', /Fix the parser/)
  assert.match(container.textContent ?? '', /Estimated cost/)
  assert.match(container.textContent ?? '', /\$0\.001032/)
  assert.equal(container.textContent?.includes('No prices set'), false)
  assert.equal(container.querySelectorAll('.tdb-surface').length, 1)
  assert.equal(container.querySelectorAll('.tdb-kpi').length, 4)
  assert.equal(container.querySelectorAll('.tdb-section-title').length, 3)
  assert.equal(container.textContent?.includes('Lifetime'), false)
  assert.equal(container.textContent?.includes('Read-only'), false)

  const languageChoices = Array.from(container.querySelectorAll<HTMLButtonElement>('.tdb-lang-choice'))
  assert.equal(languageChoices.length, 2, 'both language choices are present')
  const chinese = languageChoices.find(button => button.textContent === '中文')
  const english = languageChoices.find(button => button.textContent === 'EN')
  assert.ok(chinese, 'Chinese choice is present')
  assert.ok(english, 'English choice is present')
  await act(async () => {
    chinese.click()
  })
  assert.match(container.textContent ?? '', /Token 用量/)
  assert.match(container.textContent ?? '', /总 Token/)
  assert.equal(chinese.getAttribute('aria-pressed'), 'true')
  await act(async () => {
    english.click()
  })
  assert.match(container.textContent ?? '', /Token usage/)
  assert.match(container.textContent ?? '', /Total tokens/)
  assert.equal(english.getAttribute('aria-pressed'), 'true')

  const days7 = Array.from(container.querySelectorAll<HTMLButtonElement>('.tdb-range-btn'))
    .find(button => button.textContent === '7 days')
  assert.ok(days7, 'range control is present')
  await act(async () => {
    days7.click()
  })
  assert.equal(days7.getAttribute('aria-pressed'), 'true')

  const ioView = Array.from(container.querySelectorAll<HTMLButtonElement>('.tdb-view-btn'))
    .find(button => button.textContent === 'Input / Output')
  assert.ok(ioView, 'chart view control is present')
  await act(async () => {
    ioView.click()
  })
  assert.equal(ioView.getAttribute('aria-pressed'), 'true')

  const totalSort = Array.from(container.querySelectorAll<HTMLButtonElement>('.tdb-sort-btn'))
    .find(button => button.textContent?.includes('Total'))
  assert.ok(totalSort, 'total sort button is present')
  const totalColumn = totalSort.closest('th')
  assert.ok(totalColumn, 'total sort header is present')
  await act(async () => {
    totalSort.click()
  })
  assert.equal(totalColumn.getAttribute('aria-sort'), 'descending')
  await act(async () => {
    totalSort.click()
  })
  assert.equal(totalColumn.getAttribute('aria-sort'), 'ascending')

  const refresh = container.querySelector<HTMLButtonElement>('button[aria-label="Refresh"]')
  assert.ok(refresh, 'refresh button is present')
  await act(async () => {
    refresh.click()
  })
  assert.equal(calls.some(url => url.includes('refresh=1')), true)

  const row = container.querySelector<HTMLElement>('.tdb-row')
  assert.ok(row, 'session row is present')
  await act(async () => {
    row.click()
  })
  assert.match(container.querySelector('.tdb-drawer')?.textContent ?? '', /Open session/)

  const closeDrawer = container.querySelector<HTMLButtonElement>('.tdb-drawer button[aria-label="Close"]')
  assert.ok(closeDrawer, 'drawer close button is present')
  await act(async () => {
    closeDrawer.click()
  })
  assert.equal(container.querySelector('.tdb-drawer'), null)

  const costRow = container.querySelector<HTMLButtonElement>('.tdb-cost-row')
  assert.ok(costRow, 'cost row is present')
  await act(async () => {
    costRow.click()
  })
  const refreshPrices = Array.from(container.querySelectorAll('button'))
    .find(button => button.textContent === 'Refresh online')
  assert.ok(refreshPrices, 'online refresh button is present')
  await act(async () => {
    refreshPrices.click()
    await new Promise(resolve => setTimeout(resolve, 10))
  })
  assert.match(container.textContent ?? '', /\$0\.002400/)
  assert.match(container.textContent ?? '', /OpenRouter/)
  assert.equal(calls.some(url => url.includes('/prices')), true)

  const managePrices = Array.from(container.querySelectorAll('button'))
    .find(button => button.textContent === 'Manage prices')
  assert.ok(managePrices, 'manage prices button is present')
  await act(async () => {
    managePrices.click()
  })
  assert.match(container.querySelector('.tdb-modal')?.textContent ?? '', /Manage prices/)

  const closePrices = container.querySelector<HTMLButtonElement>('.tdb-modal button[aria-label="Close"]')
  assert.ok(closePrices, 'pricing close button is present')
  await act(async () => {
    closePrices.click()
  })
  assert.equal(container.querySelector('.tdb-modal'), null)

  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    dom.window.close()
  }
})
