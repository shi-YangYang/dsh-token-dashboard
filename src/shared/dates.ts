/** Calendar helpers. Bucket keys are local-calendar labels, never UTC instants. */

/** `YYYY-MM-DD` in the host's local time zone. */
export function dayKey(ms: number): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** `YYYY-MM-DDTHH` in the host's local time zone. */
export function hourKey(ms: number): string {
  const date = new Date(ms)
  return `${dayKey(ms)}T${pad(date.getHours())}`
}

/** Today's local calendar date. */
export function todayKey(now = Date.now()): string {
  return dayKey(now)
}

/** The process's IANA time zone, or `UTC` when the runtime cannot report one. */
export function currentTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Shift a calendar key by a whole number of days. */
export function addDays(key: string, delta: number): string {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** Inclusive list of calendar keys from `from` to `to` (bounded by caller). */
export function enumerateDays(from: string, to: string, max = 400): string[] {
  const result: string[] = []
  let cursor = from
  for (let index = 0; index <= max; index += 1) {
    result.push(cursor)
    if (cursor === to) return result
    cursor = addDays(cursor, 1)
  }
  return result
}

/** The trailing `count` calendar keys ending at `today`, ascending. */
export function lastDays(today: string, count: number): string[] {
  const from = addDays(today, -(Math.max(1, count) - 1))
  return enumerateDays(from, today, Math.max(1, count))
}

/** All 24 hour keys for one calendar day, ascending. */
export function dayHours(today: string): string[] {
  const result: string[] = []
  for (let hour = 0; hour < 24; hour += 1) result.push(`${today}T${pad(hour)}`)
  return result
}

/** Whole days between two calendar keys, at least 1. */
export function spanDays(from: string, to: string): number {
  const start = Date.parse(`${from}T12:00:00Z`)
  const end = Date.parse(`${to}T12:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1)
}

/** Validate a `YYYY-MM-DD` string and its calendar meaning. */
export function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** `HH:00` label from an hour bucket key. */
export function hourLabel(key: string): string {
  return `${key.slice(11, 13)}:00`
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}
