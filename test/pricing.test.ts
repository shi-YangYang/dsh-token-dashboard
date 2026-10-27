import test from 'node:test'
import assert from 'node:assert/strict'

import {
  costOf,
  estimateCost,
  formatAmount,
  isPriceConfigured,
  normalizePrice,
  parsePricing,
  serializePricing,
} from '../src/shared/pricing.js'
import type { ModelUsage } from '../src/shared/types.js'

function model(key: string): ModelUsage {
  return {
    key,
    provider: 'provider',
    model: key,
    requests: 2,
    uncachedInputTokens: 1_000_000,
    cacheReadTokens: 500_000,
    cacheWriteTokens: 250_000,
    outputTokens: 100_000,
  }
}

const price = { currency: 'USD', input: 1, output: 2, cacheRead: 0.5, cacheWrite: 0.25 }

test('cost is priced per million tokens across all four buckets', () => {
  assert.equal(costOf(model('m-a'), price), 1 + 0.25 + 0.0625 + 0.2)
})

test('a missing or partial price is never guessed', () => {
  assert.equal(costOf(model('m-a'), undefined), null)
  assert.equal(isPriceConfigured({ ...price, input: Number.NaN }), false)
  assert.equal(isPriceConfigured({ ...price, currency: ' ' }), false)
  assert.equal(isPriceConfigured({ ...price, cacheWrite: -1 }), false)
  assert.equal(isPriceConfigured(price), true)
})

test('estimateCost rows separate priced and unpriced models', () => {
  const estimate = estimateCost([model('m-a'), model('m-b')], { 'm-a': price })
  assert.equal(estimate.pricedModels, 1)
  assert.equal(estimate.unpricedModels, 1)
  assert.equal(estimate.totals.length, 1)
  assert.equal(estimate.totals[0]?.currency, 'USD')
  assert.equal(estimate.rows[0]?.amount, 1.5125)
  assert.equal(estimate.rows[1]?.amount, null)
  assert.equal(estimate.rows[1]?.missing, true)
})

test('estimateCost groups totals by currency and does not convert', () => {
  const estimate = estimateCost(
    [model('m-a'), model('m-b')],
    { 'm-a': price, 'm-b': { ...price, currency: 'CNY' } },
  )
  assert.deepEqual(estimate.totals.map(row => row.currency).sort(), ['CNY', 'USD'])
  assert.equal(estimate.totals.length, 2)
})

test('the persisted table is parsed defensively', () => {
  assert.deepEqual(parsePricing(null), {})
  assert.deepEqual(parsePricing('not json'), {})
  assert.deepEqual(parsePricing('[]'), {})
  const table = parsePricing(JSON.stringify({
    good: price,
    bad: { currency: 'USD', input: 'x' },
    negative: { ...price, output: -3 },
    extra: { ...price, ignored: true },
  }))
  assert.deepEqual(Object.keys(table).sort(), ['extra', 'good'])
  assert.equal(table.good?.input, 1)
  assert.equal(table.extra?.currency, 'USD')
  assert.equal(serializePricing(table), JSON.stringify(table))
  assert.match(serializePricing(table), /"good"/)
})

test('normalizePrice accepts numeric strings but rejects negative rates', () => {
  assert.deepEqual(normalizePrice({ currency: ' cny ', input: '1', output: 2, cacheRead: 0, cacheWrite: 0 }), {
    currency: 'CNY', input: 1, output: 2, cacheRead: 0, cacheWrite: 0,
  })
  assert.equal(normalizePrice({ currency: 'USD', input: -1, output: 2, cacheRead: 0, cacheWrite: 0 }), null)
  assert.equal(normalizePrice({ currency: '', input: 1, output: 2, cacheRead: 0, cacheWrite: 0 }), null)
})

test('formatAmount keeps precision for tiny estimates', () => {
  assert.match(formatAmount(0.000123, 'USD'), /0\.000123/)
  assert.match(formatAmount(12.5, 'USD'), /12\.50/)
})
