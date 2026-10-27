/**
 * Time-range selection for the dashboard. Range filtering happens on the
 * compact per-day / per-hour buckets the Host already aggregated, so changing
 * the range never triggers a log read.
 */

import { addDays, dayHours, enumerateDays, isDayKey, lastDays, spanDays } from './dates.js'
import {
  addBuckets,
  cacheHitRate as hitRateOf,
  emptyBuckets,
  sortModels,
  totalTokens,
} from './model.js'
import type { ModelUsage, StatsPayload, TokenBuckets, UsageBucket } from './types.js'

export type RangeId = 'today' | '7d' | '30d' | '90d' | 'all' | 'custom'

export interface RangeSelection {
  id: RangeId
  /** Custom range start (`YYYY-MM-DD`); ignored by the preset ranges. */
  from: string
  /** Custom range end (`YYYY-MM-DD`); ignored by the preset ranges. */
  to: string
}

export interface RangeResult {
  granularity: 'hour' | 'day'
  from: string
  to: string
  buckets: UsageBucket[]
  totals: TokenBuckets
  requests: number
  models: ModelUsage[]
  cacheHitRate: number
  totalTokens: number
}

export type RangeSource = Pick<StatsPayload, 'days' | 'hours' | 'today'>

/** Preset range lengths in days; 0 means all time and -1 means custom. */
export const RANGE_DAYS: Record<Exclude<RangeId, 'custom' | 'all'>, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

/** Build the chart bucket list and range totals for one selection. */
export function selectRange(source: RangeSource, selection: RangeSelection): RangeResult {
  const dayIndex = new Map(source.days.map(bucket => [bucket.bucket, bucket]))
  const hourIndex = new Map(source.hours.map(bucket => [bucket.bucket, bucket]))

  if (selection.id === 'today') {
    const keys = dayHours(source.today)
    const buckets = keys.map(key => hourIndex.get(key) ?? emptyBucket(key))
    return summarize(buckets, 'hour', source.today, source.today)
  }

  let keys: string[]
  let from: string
  let to: string

  if (selection.id === 'all') {
    const sorted = source.days.map(bucket => bucket.bucket).sort()
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    if (first === undefined || last === undefined) {
      return summarize([], 'day', source.today, source.today)
    }
    from = first
    to = last
    keys = spanDays(from, to) <= 400 ? enumerateDays(from, to) : sorted
  } else if (selection.id === 'custom') {
    const end = isDayKey(selection.to) ? selection.to : source.today
    const start = isDayKey(selection.from) ? selection.from : addDays(end, -29)
    const [low, high] = start <= end ? [start, end] : [end, start]
    to = high
    from = spanDays(low, high) > 400 ? addDays(high, -399) : low
    keys = enumerateDays(from, to, 400)
  } else {
    const length = RANGE_DAYS[selection.id]
    keys = lastDays(source.today, length)
    from = keys[0] ?? source.today
    to = keys[keys.length - 1] ?? source.today
  }

  const buckets = keys.map(key => dayIndex.get(key) ?? emptyBucket(key))
  return summarize(buckets, 'day', from, to)
}

/** Sum buckets and merge their model rows. */
export function summarize(buckets: UsageBucket[], granularity: 'hour' | 'day', from: string, to: string): RangeResult {
  const totals = emptyBuckets()
  const models = new Map<string, ModelUsage>()
  let requests = 0

  for (const bucket of buckets) {
    addBuckets(totals, bucket)
    requests += bucket.requests
    for (const usage of bucket.models) {
      const existing = models.get(usage.key)
      if (existing === undefined) {
        // A detached row: bucket model rows are never mutated by range logic.
        models.set(usage.key, { ...usage })
      } else {
        addBuckets(existing, usage)
        existing.requests += usage.requests
      }
    }
  }

  return {
    granularity,
    from,
    to,
    buckets,
    totals,
    requests,
    models: sortModels([...models.values()]),
    cacheHitRate: hitRateOf(totals),
    totalTokens: totalTokens(totals),
  }
}

/** Share of the range total, 0 when the range is empty. */
export function shareOf(value: number, total: number): number {
  return total <= 0 ? 0 : value / total
}

function emptyBucket(bucket: string): UsageBucket {
  return { bucket, requests: 0, models: [], ...emptyBuckets() }
}
