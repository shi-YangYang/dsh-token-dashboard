import test from 'node:test'
import assert from 'node:assert/strict'

import {
  costOf,
  estimateCost,
  formatAmount,
  defaultsForModels,
  isPriceConfigured,
  mergePricing,
  normalizePrice,
  parseOnlinePricing,
  parsePricing,
  samePrice,
  serializeOnlinePricing,
  serializePricing,
} from '../src/shared/pricing.js'
import { builtinPriceFor } from '../src/shared/builtin-prices.js'
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

test('built-in prices resolve dated and aliased DeepSeek model ids', () => {
  const flash = builtinPriceFor('deepseek-v4.1-flash-1017')
  assert.equal(flash?.currency, 'USD')
  assert.equal(flash?.input, 0.3)
  assert.equal(flash?.cacheRead, 0.006)
  assert.equal(flash?.output, 1.2)
  const pro = builtinPriceFor('deepseek/deepseek-v4-pro-0813')
  assert.equal(pro?.input, 1.32)
  assert.equal(pro?.output, 3.96)
  assert.equal(builtinPriceFor('unknown-model'), undefined)
})

test('online prices override built-ins and user overrides win last', () => {
  const usage = {
    ...model('opencode-go::deepseek-v4.1-flash'),
    model: 'deepseek-v4.1-flash',
  }
  const online = {
    'deepseek-v4.1-flash': { currency: 'USD', input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0 },
  }
  const defaults = defaultsForModels([usage], online)
  assert.equal(defaults[usage.key]?.input, 1)
  assert.equal(defaults[usage.key]?.output, 2)
  const overridden = mergePricing(defaults, {
    [usage.key]: { currency: 'CNY', input: 9, output: 8, cacheRead: 7, cacheWrite: 6 },
  })
  assert.equal(overridden[usage.key]?.input, 9)
  assert.equal(overridden[usage.key]?.currency, 'CNY')
})

test('online pricing state is parsed defensively and keeps provenance', () => {
  const state = parseOnlinePricing(JSON.stringify({
    source: 'OpenRouter',
    fetchedAt: 1234,
    prices: {
      'DeepSeek-V4.1-Flash': { currency: 'USD', input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
      bad: { currency: 'USD', input: -1, output: 2, cacheRead: 0, cacheWrite: 0 },
    },
  }))
  assert.equal(state?.source, 'OpenRouter')
  assert.equal(state?.fetchedAt, 1234)
  assert.equal(state?.prices['deepseek-v4.1-flash']?.input, 1)
  assert.equal(Object.keys(state?.prices ?? {}).length, 1)
  assert.equal(parseOnlinePricing('not json'), null)
  assert.equal(parseOnlinePricing(null), null)
  assert.deepEqual(JSON.parse(serializeOnlinePricing(state!)).source, 'OpenRouter')
})

test('samePrice compares currency and all four rates', () => {
  const left = { currency: 'USD', input: 1, output: 2, cacheRead: 0.5, cacheWrite: 0.25 }
  assert.equal(samePrice(left, { ...left }), true)
  assert.equal(samePrice(left, { ...left, input: 2 }), false)
  assert.equal(samePrice(undefined, undefined), true)
  assert.equal(samePrice(left, undefined), false)
})

test('formatAmount keeps precision for tiny estimates', () => {
  assert.match(formatAmount(0.000123, 'USD'), /0\.000123/)
  assert.match(formatAmount(12.5, 'USD'), /12\.50/)
})
