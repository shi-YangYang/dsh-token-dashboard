import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { Dashboard } from '../src/client/App.js'
import { KpiCards } from '../src/client/components/Cards.js'
import { CostPanel } from '../src/client/components/Cost.js'
import { ModelTable } from '../src/client/components/Models.js'
import { PricingEditor } from '../src/client/components/PricingEditor.js'
import { SessionDetail } from '../src/client/components/SessionDetail.js'
import { SessionTable } from '../src/client/components/Sessions.js'
import { Trends } from '../src/client/components/Trends.js'
import { en } from '../src/client/locales.js'
import type { T } from '../src/client/lib.js'
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

const bucket: UsageBucket = {
  bucket: '2026-01-05',
  requests: 4,
  models: [model],
  ...totals,
}

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

const intl = 'en-US'

const t: T = (key, params) => {
  let text = en[key] ?? key
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

test('KPI cards render the four lifetime numbers', () => {
  const markup = renderToStaticMarkup(h(KpiCards, { data: payload, t, intl }))
  assert.match(markup, /Total tokens/)
  assert.match(markup, /Input tokens/)
  assert.match(markup, /Output tokens/)
  assert.match(markup, /Cache tokens/)
  assert.match(markup, /4 requests/)
  assert.match(markup, /hit rate/)
})

test('the trend section renders one chart with three view choices', () => {
  const markup = renderToStaticMarkup(h(Trends, { data: payload, t, intl }))
  assert.match(markup, /Usage/)
  assert.match(markup, /Tokens/)
  assert.match(markup, /Input \/ Output/)
  assert.match(markup, /Cache/)
  assert.match(markup, /4K tokens/)
  assert.equal((markup.match(/<svg/g) ?? []).length, 1)
})

test('the model table shows the logged route, share, and totals', () => {
  const markup = renderToStaticMarkup(h(ModelTable, {
    models: [model],
    total: 4_000,
    t,
    intl,
  }))
  assert.match(markup, /deepseek-v4\.1-flash/)
  assert.match(markup, /opencode-go/)
  assert.match(markup, /100%/)
})

test('the session table is searchable markup with badges and lifetime totals', () => {
  const markup = renderToStaticMarkup(h(SessionTable, {
    rows: [session],
    t,
    intl,
    now,
    onSelect: () => {},
  }))
  assert.match(markup, /Fix the parser/)
  assert.match(markup, /Live/)
  assert.match(markup, /4,000/)
})

test('empty tables and cost estimates render their explicit empty states', () => {
  const models = renderToStaticMarkup(h(ModelTable, {
    models: [],
    total: 0,
    t,
    intl,
  }))
  assert.match(models, /No model usage yet\./)

  const cost = renderToStaticMarkup(h(CostPanel, {
    models: [model],
    pricing: {},
    t,
    intl,
    onConfigure: () => {},
  }))
  assert.match(cost, /No prices set/)
  assert.match(cost, /Set prices/)
})

test('a configured price renders an estimated amount', () => {
  const markup = renderToStaticMarkup(h(CostPanel, {
    models: [model],
    pricing: {
      [model.key]: { currency: 'USD', input: 1, output: 2, cacheRead: 0.5, cacheWrite: 0.25 },
    },
    t,
    intl,
    onConfigure: () => {},
  }))
  assert.match(markup, /Estimated cost/)
  assert.match(markup, /0\.003300/)
  assert.doesNotMatch(markup, /No prices set/)
})

test('the session detail modal renders metadata, totals, and model rows', () => {
  const markup = renderToStaticMarkup(h(SessionDetail, {
    session,
    t,
    intl,
    onClose: () => {},
    onOpen: () => {},
  }))
  assert.match(markup, /Fix the parser/)
  assert.match(markup, /Total tokens/)
  assert.match(markup, /Models/)
  assert.match(markup, /deepseek-v4\.1-flash/)
  assert.match(markup, /Open session/)
})

test('the pricing editor renders one editable row per model', () => {
  const markup = renderToStaticMarkup(h(PricingEditor, {
    open: true,
    models: [model],
    pricing: {},
    t,
    onClose: () => {},
    onSave: () => {},
  }))
  assert.match(markup, /Manage prices/)
  assert.match(markup, /Rates per 1M tokens/)
  assert.match(markup, /deepseek-v4\.1-flash/)
})

test('the dashboard shell renders its loading state without a Host', () => {
  const markup = renderToStaticMarkup(h(Dashboard))
  assert.match(markup, /tdb-skeleton/)
  assert.match(markup, /tdb-root/)
})
