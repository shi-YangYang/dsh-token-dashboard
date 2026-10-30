/** User-selected background price sync interval. */

export type SyncInterval = 'off' | '5m' | '15m' | '30m' | '1h' | '6h' | '12h' | '24h'

export const SYNC_INTERVALS: readonly SyncInterval[] = ['off', '5m', '15m', '30m', '1h', '6h', '12h', '24h']

export const SYNC_INTERVAL_MS: Readonly<Record<SyncInterval, number>> = {
  off: 0,
  '5m': 5 * 60 * 1_000,
  '15m': 15 * 60 * 1_000,
  '30m': 30 * 60 * 1_000,
  '1h': 60 * 60 * 1_000,
  '6h': 6 * 60 * 60 * 1_000,
  '12h': 12 * 60 * 60 * 1_000,
  '24h': 24 * 60 * 60 * 1_000,
}

export const SYNC_INTERVAL_KEY = 'dsh-token-dashboard:pricing:sync-interval:v1'
export const DEFAULT_SYNC_INTERVAL: SyncInterval = '6h'

export function readSyncInterval(): SyncInterval {
  try {
    const raw = localStorage.getItem(SYNC_INTERVAL_KEY)
    return raw !== null && (SYNC_INTERVALS as readonly string[]).includes(raw)
      ? raw as SyncInterval
      : DEFAULT_SYNC_INTERVAL
  } catch {
    return DEFAULT_SYNC_INTERVAL
  }
}

export function saveSyncInterval(value: SyncInterval): void {
  try {
    localStorage.setItem(SYNC_INTERVAL_KEY, value)
  } catch {
    // Private mode keeps the in-memory value.
  }
}
