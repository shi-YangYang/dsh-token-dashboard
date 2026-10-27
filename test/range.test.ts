import test from 'node:test'
import assert from 'node:assert/strict'

import { selectRange, shareOf, summarize } from '../src/shared/range.js'
import type { ModelUsage, UsageBucket } from '../src/shared/types.js'

function model(key: string, input: number, output: number, requests: number): ModelUsage {
  return {
    key,
    provider: 'provider',
    model: key,
    requests,
    uncachedInputTokens: input,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: output,
  }
}

function bucket(key: string, input: number, output: number, requests: number, models: ModelUsage[]): UsageBucket {
  return {
    bucket: key,
    requests,
    models,
    uncachedInputTokens: input,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: output,
  }
}

const days: UsageBucket[] = [
  bucket('2026-01-01', 10, 1, 1, [model('m-a', 10, 1, 1)]),
  bucket('2026-01-03', 20, 2, 1, [model('m-a', 20, 2, 1)]),
  bucket('2026-01-07', 30, 3, 2, [model('m-b', 30, 3, 2)]),
]
const hours: UsageBucket[] = [
  bucket('2026-01-07T09', 4, 1, 1, [model('m-b', 4, 1, 1)]),
  bucket('2026-01-07T10', 6, 2, 1, [model('m-b', 6, 2, 1)]),
]
const source = { days, hours, today: '2026-01-07' }

test('last-7-days fills empty calendar days and sums only the window', () => {
  const result = selectRange(source, { id: '7d', from: '', to: '' })
  assert.equal(result.granularity, 'day')
  assert.equal(result.buckets.length, 7)
  assert.equal(result.buckets[0]?.bucket, '2026-01-01')
  assert.equal(result.buckets[6]?.bucket, '2026-01-07')
  assert.equal(result.totals.uncachedInputTokens, 60)
  assert.equal(result.requests, 4)
  assert.equal(result.models.length, 2)
  assert.equal(result.totalTokens, 66)
})

test('today uses 24 hourly buckets and only today', () => {
  const result = selectRange(source, { id: 'today', from: '', to: '' })
  assert.equal(result.granularity, 'hour')
  assert.equal(result.buckets.length, 24)
  assert.equal(result.buckets[9]?.uncachedInputTokens, 4)
  assert.equal(result.buckets[10]?.outputTokens, 2)
  assert.equal(result.buckets[0]?.uncachedInputTokens, 0)
  assert.equal(result.totals.uncachedInputTokens, 10)
  assert.equal(result.requests, 2)
})

test('all time spans the first to the last day and fills gaps', () => {
  const result = selectRange(source, { id: 'all', from: '', to: '' })
  assert.equal(result.buckets.length, 7)
  assert.equal(result.totals.uncachedInputTokens, 60)
  assert.equal(result.from, '2026-01-01')
  assert.equal(result.to, '2026-01-07')
})

test('custom range is inclusive and swaps reversed bounds', () => {
  const forward = selectRange(source, { id: 'custom', from: '2026-01-02', to: '2026-01-03' })
  assert.equal(forward.buckets.length, 2)
  assert.equal(forward.totals.uncachedInputTokens, 20)

  const reversed = selectRange(source, { id: 'custom', from: '2026-01-03', to: '2026-01-02' })
  assert.equal(reversed.from, '2026-01-02')
  assert.equal(reversed.to, '2026-01-03')
  assert.equal(reversed.totals.uncachedInputTokens, 20)
})

test('an invalid custom range falls back to the last 30 days', () => {
  const result = selectRange(source, { id: 'custom', from: 'nope', to: 'nope' })
  assert.equal(result.buckets.length, 30)
  assert.equal(result.totals.uncachedInputTokens, 60)
})

test('summary merges model rows across buckets without double counting', () => {
  const result = summarize(days, 'day', '2026-01-01', '2026-01-07')
  const modelA = result.models.find(item => item.key === 'm-a')
  const modelB = result.models.find(item => item.key === 'm-b')
  assert.equal(modelA?.requests, 2)
  assert.equal(modelA?.uncachedInputTokens, 30)
  assert.equal(modelB?.requests, 2)
  assert.equal(modelB?.uncachedInputTokens, 30)
  assert.equal(result.totalTokens, 66)
})

test('shareOf never divides by zero', () => {
  assert.equal(shareOf(10, 0), 0)
  assert.equal(shareOf(10, 40), 0.25)
})
