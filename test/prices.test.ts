import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createPriceService,
  parseOpenRouterEntries,
  resolveOpenRouterPrice,
} from '../src/host/prices.js'
import type { PriceFetch } from '../src/host/prices.js'

const payload = {
  data: [
    {
      id: 'deepseek/deepseek-v4.1-flash-1017',
      pricing: {
        prompt: '0.0000003',
        completion: '0.0000012',
        input_cache_read: '0.000000006',
      },
    },
    {
      id: 'openai/gpt-6.1-terra-20261026',
      pricing: {
        prompt: '0.000001',
        completion: '0.000005',
        input_cache_read: '0.00000005',
        input_cache_write: '0.00000125',
      },
    },
    {
      id: 'openai/gpt-6.1-terra-20261026:batch',
      pricing: {
        prompt: '0.0000005',
        completion: '0.0000025',
        input_cache_read: '0.000000025',
        input_cache_write: '0.000000625',
      },
    },
    {
      id: 'free/example:free',
      pricing: { prompt: '0', completion: '0' },
    },
    {
      id: 'broken/example',
      pricing: { prompt: '-1', completion: 'not-a-number' },
    },
  ],
}

test('OpenRouter prices convert per-token strings into per-million USD', () => {
  const entries = parseOpenRouterEntries(payload)
  const deepseek = resolveOpenRouterPrice(entries, 'deepseek-v4.1-flash')
  assert.deepEqual(deepseek, {
    currency: 'USD',
    input: 0.3,
    output: 1.2,
    cacheRead: 0.006,
    cacheWrite: 0,
  })
  assert.equal(resolveOpenRouterPrice(entries, 'unknown-model'), undefined)
})

test('dated aliases match and standard variants beat batch variants', () => {
  const entries = parseOpenRouterEntries(payload)
  const terra = resolveOpenRouterPrice(entries, 'gpt-6.1-terra')
  assert.equal(terra?.input, 1)
  assert.equal(terra?.output, 5)
  assert.equal(terra?.cacheWrite, 1.25)
  assert.equal(resolveOpenRouterPrice(entries, 'deepseek-flash')?.input, 0.3)
})

test('the Host price service caches until an explicit refresh', async () => {
  let calls = 0
  let now = 1_000
  const fetchImpl: PriceFetch = async () => {
    calls += 1
    return {
      ok: true,
      status: 200,
      json: async () => payload,
    }
  }
  const service = createPriceService({
    fetch: fetchImpl,
    now: () => now,
    ttlMs: 10_000,
  })
  const first = await service.lookup(['deepseek-flash'], true)
  assert.equal(first.source, 'OpenRouter')
  assert.equal(first.prices['deepseek-flash']?.input, 0.3)
  assert.equal(calls, 1)
  now += 5_000
  await service.lookup(['deepseek-flash'], false)
  assert.equal(calls, 1, 'the cached list is reused')
  await service.lookup(['deepseek-flash'], true)
  assert.equal(calls, 2, 'refresh=1 bypasses the cache')
})

test('a failed Host fetch rejects so the client keeps built-in prices', async () => {
  const service = createPriceService({
    fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    now: () => 1,
  })
  await assert.rejects(service.lookup(['deepseek-flash'], true), /HTTP 503/)
})
