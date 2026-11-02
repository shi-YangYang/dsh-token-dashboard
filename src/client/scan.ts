/** User-selected local session scan interval. */

export type ScanInterval = '5s' | '10s' | '30s' | '60s'

export const SCAN_INTERVALS: readonly ScanInterval[] = ['5s', '10s', '30s', '60s']

export const SCAN_INTERVAL_MS: Readonly<Record<ScanInterval, number>> = {
  '5s': 5_000,
  '10s': 10_000,
  '30s': 30_000,
  '60s': 60_000,
}

export const SCAN_INTERVAL_KEY = 'dsh-token-dashboard:scan-interval:v1'
export const DEFAULT_SCAN_INTERVAL: ScanInterval = '5s'

export function readScanInterval(): ScanInterval {
  try {
    const raw = localStorage.getItem(SCAN_INTERVAL_KEY)
    return raw !== null && (SCAN_INTERVALS as readonly string[]).includes(raw)
      ? raw as ScanInterval
      : DEFAULT_SCAN_INTERVAL
  } catch {
    return DEFAULT_SCAN_INTERVAL
  }
}

export function saveScanInterval(value: ScanInterval): void {
  try {
    localStorage.setItem(SCAN_INTERVAL_KEY, value)
  } catch {
    // Private mode keeps the in-memory value.
  }
}
