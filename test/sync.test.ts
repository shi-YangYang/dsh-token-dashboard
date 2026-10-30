import test from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_SYNC_INTERVAL, SYNC_INTERVAL_KEY, readSyncInterval, saveSyncInterval } from '../src/client/sync.js'

test('the sync interval setting persists and rejects unknown values', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    },
  })
  try {
    assert.equal(readSyncInterval(), DEFAULT_SYNC_INTERVAL)
    saveSyncInterval('15m')
    assert.equal(values.get(SYNC_INTERVAL_KEY), '15m')
    assert.equal(readSyncInterval(), '15m')
    values.set(SYNC_INTERVAL_KEY, 'sometimes')
    assert.equal(readSyncInterval(), DEFAULT_SYNC_INTERVAL)
  } finally {
    if (previous === undefined) delete (globalThis as { localStorage?: unknown }).localStorage
    else Object.defineProperty(globalThis, 'localStorage', previous)
  }
})
