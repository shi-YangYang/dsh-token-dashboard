import test from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_SCAN_INTERVAL, SCAN_INTERVAL_KEY, readScanInterval, saveScanInterval } from '../src/client/scan.js'

test('the scan interval setting persists and rejects unknown values', () => {
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
    assert.equal(readScanInterval(), DEFAULT_SCAN_INTERVAL)
    saveScanInterval('10s')
    assert.equal(values.get(SCAN_INTERVAL_KEY), '10s')
    assert.equal(readScanInterval(), '10s')
    values.set(SCAN_INTERVAL_KEY, 'sometimes')
    assert.equal(readScanInterval(), DEFAULT_SCAN_INTERVAL)
  } finally {
    if (previous === undefined) delete (globalThis as { localStorage?: unknown }).localStorage
    else Object.defineProperty(globalThis, 'localStorage', previous)
  }
})
