/** Presentation helpers. All functions are pure and locale-optional. */

/** Exact grouped integer. */
export function formatNumber(value: number, locale?: string): string {
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}

/** Compact token count for cards and axes: 12.4K, 3.1M, 1.2B. */
export function formatCompact(value: number, locale?: string): string {
  if (!Number.isFinite(value) || value === 0) return '0'
  if (Math.abs(value) < 1_000) return formatNumber(value, locale)
  try {
    return new Intl.NumberFormat(locale, {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: value >= 1_000_000 ? 2 : 1,
    }).format(value)
  } catch {
    return formatNumber(value, locale)
  }
}

/** Ratio in [0,1] rendered as a percentage. */
export function formatPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return '0%'
  const value = ratio * 100
  const rounded = digits <= 0 ? Math.round(value) : Number(value.toFixed(digits))
  return `${rounded}%`
}

/** Medium date + short time for timestamps. */
export function formatDateTime(ms: number, locale?: string): string {
  const date = new Date(ms)
  if (!Number.isFinite(date.getTime())) return '—'
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  } catch {
    return date.toISOString()
  }
}

/** Short calendar-day label for a `YYYY-MM-DD` bucket key. */
export function formatDayLabel(key: string, locale?: string): string {
  const date = new Date(`${key}T12:00:00`)
  if (!Number.isFinite(date.getTime())) return key
  try {
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date)
  } catch {
    return key
  }
}

/** `14:00` from a `YYYY-MM-DDTHH` bucket key. */
export function formatHourLabel(key: string): string {
  return `${key.slice(11, 13)}:00`
}

/** Relative time (e.g. "3 hours ago") with an absolute fallback. */
export function formatRelative(ms: number, now = Date.now(), locale?: string): string {
  const delta = ms - now
  if (!Number.isFinite(delta)) return '—'
  try {
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    const table: Array<[Intl.RelativeTimeFormatUnit, number]> = [
      ['year', 365 * 86_400_000],
      ['month', 30 * 86_400_000],
      ['day', 86_400_000],
      ['hour', 3_600_000],
      ['minute', 60_000],
    ]
    for (const [unit, size] of table) {
      if (Math.abs(delta) >= size) return formatter.format(Math.round(delta / size), unit)
    }
    return formatter.format(0, 'second')
  } catch {
    return formatDateTime(ms, locale)
  }
}

/** Width in CSS pixels for a compact size label. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
