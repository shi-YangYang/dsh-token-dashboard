import test from 'node:test'
import assert from 'node:assert/strict'

import { createAggregate, foldInto, foldSession, summarizeSession } from '../src/host/fold.js'
import { cacheHitRate, totalTokens } from '../src/shared/model.js'
import {
  HOUR,
  T0,
  assistantAttempt,
  assistantMessage,
  ev,
  header,
  requestHeader,
  streamUsage,
  usage,
} from './helpers.js'

const NOW = T0 + HOUR

test('sums the four disjoint provider buckets exactly once', () => {
  const aggregate = foldSession(header(), [
    requestHeader(0, 'provider-a', 'model-a'),
    assistantMessage(1, 1, 1, {
      usage: usage({ inputTokens: 100, cacheReadTokens: 20, cacheWriteTokens: 30, outputTokens: 50 }),
    }),
  ], 0, { now: NOW })

  assert.deepEqual(aggregate.totals, {
    uncachedInputTokens: 100,
    cacheReadTokens: 20,
    cacheWriteTokens: 30,
    outputTokens: 50,
  })
  assert.equal(totalTokens(aggregate.totals), 200)
  assert.equal(aggregate.requests, 1)
  assert.equal(aggregate.allRequests, 1)
  assert.equal(aggregate.models['provider-a::model-a']?.requests, 1)
  assert.equal(cacheHitRate(aggregate.totals), 20 / 150)
})

test('a final assistant message replaces the streaming sample of the same attempt', () => {
  const aggregate = foldSession(header(), [
    requestHeader(0, 'provider-a', 'model-a'),
    ev('assistant/attempt', 1, T0, {
      turn: 1,
      step: 1,
      stream: streamUsage(usage({ inputTokens: 300, outputTokens: 40 })),
    }),
    assistantMessage(2, 1, 1, {
      usage: usage({ inputTokens: 300, outputTokens: 90 }),
      stream: streamUsage(usage({ inputTokens: 300, outputTokens: 90 })),
    }),
  ], 0, { now: NOW })

  assert.deepEqual(aggregate.totals, {
    uncachedInputTokens: 300,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 90,
  })
  assert.equal(aggregate.requests, 1)
})

test('llm/retry-started closes the replacement scope so a retry is billed separately', () => {
  const aggregate = foldSession(header(), [
    requestHeader(0, 'provider-a', 'model-a'),
    assistantAttempt(1, 1, 1, usage({ inputTokens: 10, outputTokens: 1 })),
    ev('llm/retry-started', 2, T0, { turn: 1, step: 1 }),
    assistantAttempt(3, 1, 1, usage({ inputTokens: 20, outputTokens: 2 })),
    assistantMessage(4, 1, 1, { usage: usage({ inputTokens: 20, outputTokens: 5 }) }),
  ], 0, { now: NOW })

  assert.deepEqual(aggregate.totals, {
    uncachedInputTokens: 30,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 6,
  })
  assert.equal(aggregate.requests, 2)
})

test('retry-started for another step does not drop the replacement scope', () => {
  const aggregate = foldSession(header(), [
    requestHeader(0, 'provider-a', 'model-a'),
    assistantAttempt(1, 1, 1, usage({ inputTokens: 10, outputTokens: 1 })),
    ev('llm/retry-started', 2, T0, { turn: 1, step: 2 }),
    assistantMessage(3, 1, 1, { usage: usage({ inputTokens: 10, outputTokens: 4 }) }),
  ], 0, { now: NOW })

  assert.equal(aggregate.requests, 1)
  assert.equal(aggregate.totals.outputTokens, 4)
})

test('attributes each attempt to the logged route, falling back to Unknown', () => {
  const aggregate = foldSession(header(), [
    requestHeader(0, 'provider-a', 'model-a'),
    assistantAttempt(1, 1, 1, usage({ inputTokens: 5, outputTokens: 1 })),
    assistantMessage(2, 1, 1, {
      usage: usage({ inputTokens: 5, outputTokens: 2 }),
      provider: 'provider-b',
      model: 'model-b',
    }),
    assistantMessage(3, 2, 1, {
      usage: usage({ inputTokens: 7, outputTokens: 3 }),
      provider: 'provider-b',
      model: 'model-b',
    }),
  ], 0, { now: NOW })

  const rows = summarizeSession(aggregate).models
  // The attempt and its final message share one replacement scope, so the
  // final route owns the whole sample and no zero-request row survives.
  assert.equal(rows.length, 1)
  assert.equal(aggregate.models['provider-a::model-a'], undefined)
  const modelB = aggregate.models['provider-b::model-b']
  assert.equal(modelB?.requests, 2)
  assert.equal(modelB?.uncachedInputTokens, 12)
  assert.equal(modelB?.outputTokens, 5)
})

test('an event with no route information is attributed to Unknown, never guessed', () => {
  const aggregate = foldSession(header(), [
    assistantMessage(0, 1, 1, {
      usage: usage({ inputTokens: 9, outputTokens: 1 }),
      provider: 'mystery',
      model: 'mystery-model',
    }),
  ], 0, { now: NOW })

  assert.equal(aggregate.models['mystery::mystery-model']?.requests, 1)

  const orphan = foldSession(header(), [
    ev('assistant/attempt', 0, T0, {
      turn: 1,
      step: 1,
      stream: streamUsage(usage({ inputTokens: 3, outputTokens: 1 })),
    }),
  ], 0, { now: NOW })
  assert.equal(orphan.models.unknown?.requests, 1)
  assert.equal(orphan.models.unknown?.model, '')
})

test('an attempt event ignores a direct data.usage field, matching tokenUsage', () => {
  const aggregate = foldSession(header(), [
    requestHeader(0, 'provider-a', 'model-a'),
    ev('assistant/attempt', 1, T0, {
      turn: 1,
      step: 1,
      usage: usage({ inputTokens: 999, outputTokens: 999 }),
      stream: [],
    }),
  ], 0, { now: NOW })

  assert.equal(aggregate.requests, 0)
  assert.equal(totalTokens(aggregate.totals), 0)
})

test('inherited seed events feed diagnostics only, never the session or global totals', () => {
  const aggregate = foldSession(header({ isSeeded: true }), [
    requestHeader(0, 'provider-a', 'model-a'),
    ev('session/title', 1, T0, { title: 'Inherited title', messageSeqs: [], source: { kind: 'fallback' } }),
    assistantMessage(2, 1, 1, { usage: usage({ inputTokens: 1000, outputTokens: 500 }), time: T0 - HOUR }),
    assistantMessage(3, 2, 1, { usage: usage({ inputTokens: 10, outputTokens: 5 }), time: T0 }),
  ], 3, { now: NOW })

  assert.equal(aggregate.totals.uncachedInputTokens, 10)
  assert.equal(aggregate.totals.outputTokens, 5)
  assert.equal(aggregate.requests, 1)
  assert.equal(aggregate.allTotals.uncachedInputTokens, 1010)
  assert.equal(aggregate.allTotals.outputTokens, 505)
  assert.equal(aggregate.allRequests, 2)
  assert.equal(aggregate.title, 'Inherited title')
  assert.equal(aggregate.lastActivity, T0)
  assert.equal(aggregate.inheritedEventCount, 3)
})

test('duplicate event sequence numbers are folded once', () => {
  const aggregate = foldSession(header(), [
    requestHeader(0, 'provider-a', 'model-a'),
    assistantMessage(1, 1, 1, { usage: usage({ inputTokens: 10, outputTokens: 1 }) }),
    assistantMessage(1, 1, 1, { usage: usage({ inputTokens: 10, outputTokens: 1 }) }),
  ], 0, { now: NOW })

  assert.equal(aggregate.requests, 1)
  assert.equal(totalTokens(aggregate.totals), 11)
})

test('buckets usage by local day and hour and moves replacements between them', () => {
  const late = new Date(2026, 0, 6, 23, 30, 0).getTime()
  const aggregate = foldSession(header(), [
    requestHeader(0, 'provider-a', 'model-a'),
    assistantMessage(1, 1, 1, {
      usage: usage({ inputTokens: 100, outputTokens: 10 }),
      time: T0,
    }),
    assistantMessage(2, 1, 1, {
      usage: usage({ inputTokens: 200, outputTokens: 20 }),
      time: late,
    }),
  ], 0, { now: late + HOUR })

  const days = Object.values(aggregate.days)
  assert.equal(days.length, 1)
  assert.equal(days[0]?.bucket, '2026-01-06')
  assert.equal(days[0]?.requests, 1)
  assert.equal(days[0]?.uncachedInputTokens, 200)
  const hours = Object.values(aggregate.hours)
  assert.equal(hours.length, 1)
  assert.equal(hours[0]?.bucket, '2026-01-06T23')
})

test('hour buckets older than the retention window are not retained', () => {
  const old = new Date(2026, 0, 1, 9, 0, 0).getTime()
  const aggregate = foldSession(header(), [
    requestHeader(0, 'provider-a', 'model-a'),
    assistantMessage(1, 1, 1, { usage: usage({ inputTokens: 4, outputTokens: 1 }), time: old }),
  ], 0, { now: T0 })

  assert.equal(Object.keys(aggregate.hours).length, 0)
  assert.equal(Object.keys(aggregate.days).length, 1)
})

test('incremental folds append without double counting and keep the slot scope', () => {
  const aggregate = createAggregate(header(), 0)
  foldInto(aggregate, [
    requestHeader(0, 'provider-a', 'model-a'),
    assistantAttempt(1, 1, 1, usage({ inputTokens: 10, outputTokens: 1 })),
  ], { now: NOW })
  foldInto(aggregate, [
    assistantMessage(2, 1, 1, { usage: usage({ inputTokens: 10, outputTokens: 4 }) }),
  ], { now: NOW })

  assert.equal(aggregate.requests, 1)
  assert.equal(aggregate.totals.uncachedInputTokens, 10)
  assert.equal(aggregate.totals.outputTokens, 4)
  assert.equal(aggregate.processed, 3)
})

test('a zero-usage attempt is still one billed request', () => {
  const aggregate = foldSession(header(), [
    requestHeader(0, 'provider-a', 'model-a'),
    assistantAttempt(1, 1, 1, usage({ inputTokens: 0, outputTokens: 0 })),
  ], 0, { now: NOW })

  assert.equal(aggregate.requests, 1)
  assert.equal(totalTokens(aggregate.totals), 0)
  assert.equal(aggregate.models['provider-a::model-a']?.requests, 1)
})

test('the latest title event wins', () => {
  const aggregate = foldSession(header(), [
    ev('session/title', 0, T0, { title: 'First' }),
    ev('session/title', 1, T0 + 1, { title: 'Second' }),
  ], 0, { now: NOW })
  assert.equal(aggregate.title, 'Second')
})

test('malformed usage values degrade to zero instead of NaN or negative totals', () => {
  const aggregate = foldSession(header(), [
    requestHeader(0, 'provider-a', 'model-a'),
    assistantMessage(1, 1, 1, {
      usage: { inputTokens: -5, outputTokens: Number.NaN, cacheReadTokens: 2.6, cacheWriteTokens: 1 } as never,
    }),
  ], 0, { now: NOW })

  assert.deepEqual(aggregate.totals, {
    uncachedInputTokens: 0,
    cacheReadTokens: 3,
    cacheWriteTokens: 1,
    outputTokens: 0,
  })
})
