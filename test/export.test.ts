import test from 'node:test'
import assert from 'node:assert/strict'

import { csvCell, sessionsCsv, statsJson, summaryCsv } from '../src/shared/export.js'
import type { SessionSummary, StatsPayload } from '../src/shared/types.js'

const row: SessionSummary = {
  id: 'session-a',
  title: 'A title, with "quotes"',
  project: 'Project A',
  cwd: '/Users/example/secret-project',
  modelKeys: ['provider::model-a'],
  createdAt: Date.UTC(2026, 0, 5, 10),
  lastActivity: Date.UTC(2026, 0, 5, 11),
  live: true,
  origin: 'root',
  seeded: false,
  parentSession: null,
  agentPreset: 'default',
  totals: {
    uncachedInputTokens: 10,
    cacheReadTokens: 20,
    cacheWriteTokens: 0,
    outputTokens: 30,
  },
  requests: 2,
  cacheHitRate: 20 / 30,
  models: [{
    key: 'provider::model-a',
    provider: 'provider',
    model: 'model-a',
    requests: 2,
    uncachedInputTokens: 10,
    cacheReadTokens: 20,
    cacheWriteTokens: 0,
    outputTokens: 30,
  }],
  eventCount: 5,
  inheritedEventCount: 0,
  stale: false,
}

const payload: StatsPayload = {
  apiVersion: 1,
  revision: 3,
  generatedAt: Date.UTC(2026, 0, 5, 12),
  timezone: 'Asia/Shanghai',
  today: '2026-01-05',
  totals: row.totals,
  requests: 2,
  cacheHitRate: 20 / 30,
  sessions: { total: 1, withUsage: 1, live: 1, subagents: 0, seeded: 0 },
  models: row.models,
  days: [{
    bucket: '2026-01-05',
    requests: 2,
    models: row.models,
    ...row.totals,
  }],
  hours: [],
  sessionRows: [row],
  scan: {
    sessionsDiscovered: 1,
    sessionsRead: 1,
    sessionsReused: 0,
    sessionsFailed: 0,
    durationMs: 5,
    startedAt: Date.UTC(2026, 0, 5, 12),
    generatedAt: Date.UTC(2026, 0, 5, 12),
    partial: false,
  },
  errors: [],
}

test('CSV cells are quoted, escaped, and guarded against formula injection', () => {
  assert.equal(csvCell('plain'), 'plain')
  assert.equal(csvCell('a,b'), '"a,b"')
  assert.equal(csvCell('say "hi"'), '"say ""hi"""')
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"')
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)")
  assert.equal(csvCell('+1'), "'+1")
})

test('summary CSV carries metrics and one row per model', () => {
  const csv = summaryCsv(payload, payload.models, payload.totals, 'All time')
  assert.match(csv, /Total Tokens,60/)
  assert.match(csv, /Cache Read Tokens,20/)
  assert.match(csv, /Output Tokens,30/)
  assert.match(csv, /Cache Hit Rate \(%\),66\.67/)
  assert.match(csv, /model-a,provider,60,10,20,0,30,2,100\.00/)
})

test('session CSV includes lifetime counters and escapes the title', () => {
  const csv = sessionsCsv(payload)
  const lines = csv.trim().split('\r\n')
  assert.equal(lines.length, 2)
  assert.match(lines[0] ?? '', /^Session ID,Title,Project,Models/)
  assert.match(lines[1] ?? '', /session-a,"A title, with ""quotes""",Project A,model-a/)
  assert.match(lines[1] ?? '', /,60,10,20,0,30,2,66\.67,yes,root,no$/)
})

test('JSON export strips cwd and contains no message text', () => {
  const json = statsJson(payload)
  const parsed = JSON.parse(json) as StatsPayload
  assert.equal(parsed.sessionRows[0]?.cwd, null)
  assert.equal(parsed.sessionRows[0]?.title, row.title)
  assert.equal(json.includes('/Users/example/secret-project'), false)
  assert.equal(json.includes('assistant text'), false)
  assert.equal(json.includes('prompt'), false)
})
