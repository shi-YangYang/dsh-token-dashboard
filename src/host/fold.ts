/**
 * The pure token fold.
 *
 * It mirrors the official `tokenUsage` projection from
 * `@deepseek-ai/dsh-token-meter`: the four provider buckets
 * (`inputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `outputTokens`) are
 * disjoint, a later sample for the same (turn, step) replaces the previous
 * sample instead of adding to it, and `llm/retry-started` closes that
 * replacement scope so the retried attempt is billed separately. It also
 * attributes each sample to the provider/model route the log records, buckets
 * usage by local day and hour, and derives the session title.
 *
 * Events inherited by a seeded (forked) session are folded into `allTotals`
 * for diagnostics but excluded from the session's own totals and from every
 * global aggregate, so a forked prefix is never counted twice.
 */

import { dayKey, hourKey } from '../shared/dates.js'
import {
  addBuckets,
  cacheHitRate,
  emptyBuckets,
  modelKeyOf,
  subtractBuckets,
  totalTokens,
} from '../shared/model.js'
import type { ModelUsage, TokenBuckets, UsageBucket } from '../shared/types.js'
import type { RawSessionEvent, SessionHeaderLike, UsageSample } from './types.js'

const DEFAULT_KEEP_HOURS_MS = 48 * 60 * 60 * 1000

/** The last usage sample not yet closed by a retry; replacement scope. */
export interface UsageTiming {
  /** Time from step start to the first streamed token, when derivable. */
  firstTokenMs: number | null
  /** Time from first streamed token to the final stream record. */
  generationMs: number | null
  /** Full measured request window (first token plus generation, or fallback). */
  totalMs: number | null
}

export interface RequestSample {
  key: string
  time: number
  provider: string
  model: string
  modelKey: string
  buckets: TokenBuckets
  speed: number | null
  firstToken: number | null
}

export interface UsageSlot {
  turn: number
  step: number
  time: number
  buckets: TokenBuckets
  provider: string
  model: string
  modelKey: string
  timing: UsageTiming | null
  requestKey: string
}

/** Mutable incremental state carried between folds of the same session. */
export interface FoldCarry {
  /** Highest event seq folded so far; -1 before the first event. */
  lastSeq: number
  /** Replacement scope for this session's own (non-inherited) events. */
  own: UsageSlot | null
  /** Replacement scope over the whole log, used only for verification. */
  all: UsageSlot | null
  currentProvider: string
  currentModel: string
  stepStart: { turn: number; step: number; time: number } | null
}

/** One session's derived token state. Plain JSON, no raw event content. */
export interface SessionAggregate {
  totals: TokenBuckets
  allTotals: TokenBuckets
  requests: number
  allRequests: number
  models: Record<string, ModelUsage>
  days: Record<string, UsageBucket>
  hours: Record<string, UsageBucket>
  title: string | null
  lastActivity: number
  createdAt: number
  processed: number
  inheritedEventCount: number
  /** Billed requests retained for the request log (own events only). */
  requestSamples: RequestSample[]
  carry: FoldCarry
}

export interface FoldOptions {
  /** Wall clock used for hour-bucket retention. */
  now?: number
  /** Hours retained for the hourly "today" chart. */
  keepHoursMs?: number
}

/** Create an empty aggregate for one session. */
export function createAggregate(header: SessionHeaderLike, inheritedEventCount: number): SessionAggregate {
  const createdAt = finiteNumber(header.createdAt) ?? Date.now()
  return {
    totals: emptyBuckets(),
    allTotals: emptyBuckets(),
    requests: 0,
    allRequests: 0,
    models: {},
    days: {},
    hours: {},
    title: null,
    lastActivity: createdAt,
    createdAt,
    processed: 0,
    inheritedEventCount: Math.max(0, Math.trunc(inheritedEventCount)),
    requestSamples: [],
    carry: {
      lastSeq: -1,
      own: null,
      all: null,
      currentProvider: '',
      currentModel: '',
      stepStart: null,
    },
  }
}

/** Fold additional contiguous events into one aggregate in place. */
export function foldInto(aggregate: SessionAggregate, events: readonly RawSessionEvent[], options: FoldOptions = {}): void {
  const now = options.now ?? Date.now()
  const keepHoursMs = options.keepHoursMs ?? DEFAULT_KEEP_HOURS_MS
  const inherited = aggregate.inheritedEventCount

  for (const event of events) {
    if (!isEvent(event)) continue
    if (event.seq <= aggregate.carry.lastSeq) continue

    const data = asRecord(event.data)
    const time = finiteNumber(event.time) ?? aggregate.createdAt
    const isOwn = event.seq >= inherited

    if (event.type === 'request/header') {
      const config = asRecord(asRecord(data?.header)?.config)
      const provider = cleanText(config?.provider)
      const model = cleanText(config?.model)
      if (model !== '') {
        aggregate.carry.currentProvider = provider
        aggregate.carry.currentModel = model
      }
    } else if (event.type === 'llm/retry-started') {
      const turn = finiteNumber(data?.turn)
      const step = finiteNumber(data?.step)
      if (turn !== null && step !== null) {
        if (aggregate.carry.own?.turn === turn && aggregate.carry.own.step === step) aggregate.carry.own = null
        if (aggregate.carry.all?.turn === turn && aggregate.carry.all.step === step) aggregate.carry.all = null
      }
    } else if (event.type === 'step/start') {
      const turn = finiteNumber(data?.turn)
      const step = finiteNumber(data?.step)
      if (turn !== null && step !== null) {
        aggregate.carry.stepStart = { turn, step, time }
      }
    } else if (event.type === 'session/title') {
      const title = cleanText(data?.title)
      if (title !== '') aggregate.title = title
    } else if (event.type === 'assistant/message' || event.type === 'assistant/attempt') {
      const turn = finiteNumber(data?.turn)
      const step = finiteNumber(data?.step)
      const usage = readUsage(event)
      if (turn !== null && step !== null && usage !== undefined) {
        const buckets = bucketsOf(usage)
        const identity = identityOf(event, aggregate.carry)
        const timing = isOwn ? readTiming(data, aggregate.carry.stepStart, turn, step, time) : null
        const requestKey = `${event.seq}:${turn}:${step}`
        const next: UsageSlot = {
          turn,
          step,
          time,
          buckets,
          provider: identity.provider,
          model: identity.model,
          modelKey: modelKeyOf(identity.provider, identity.model),
          timing,
          requestKey,
        }

        const previousAll = aggregate.carry.all !== null
          && aggregate.carry.all.turn === turn
          && aggregate.carry.all.step === step
          ? aggregate.carry.all
          : null
        if (previousAll === null) {
          aggregate.allRequests += 1
        } else {
          subtractBuckets(aggregate.allTotals, previousAll.buckets)
        }
        addBuckets(aggregate.allTotals, buckets)
        aggregate.carry.all = next

        if (isOwn) {
          const previous = aggregate.carry.own !== null
            && aggregate.carry.own.turn === turn
            && aggregate.carry.own.step === step
            ? aggregate.carry.own
            : null

          if (previous !== null) {
            subtractBuckets(aggregate.totals, previous.buckets)
            applyModelDelta(aggregate, previous, -1)
            applyBucketDelta(aggregate, previous, -1, now, keepHoursMs)
            aggregate.requestSamples = aggregate.requestSamples.filter(sample => sample.key !== previous.requestKey)
          } else {
            aggregate.requests += 1
          }
          addBuckets(aggregate.totals, next.buckets)
          applyModelDelta(aggregate, next, 1)
          applyBucketDelta(aggregate, next, 1, now, keepHoursMs)
          aggregate.requestSamples.push(requestSample(next, timing))
          aggregate.carry.own = next
        }
      }
    }

    if (isOwn && time > aggregate.lastActivity) aggregate.lastActivity = time
    aggregate.carry.lastSeq = event.seq
  }

  aggregate.processed = aggregate.carry.lastSeq + 1
}

/** Fold one complete session log from scratch. */
export function foldSession(
  header: SessionHeaderLike,
  events: readonly RawSessionEvent[],
  inheritedEventCount: number,
  options: FoldOptions = {},
): SessionAggregate {
  const aggregate = createAggregate(header, inheritedEventCount)
  foldInto(aggregate, events, options)
  return aggregate
}

/** Detached, wire-safe session counters for diagnostics and row rendering. */
export function summarizeSession(aggregate: SessionAggregate): {
  totals: TokenBuckets
  requests: number
  cacheHitRate: number
  models: ModelUsage[]
  eventCount: number
  inheritedEventCount: number
} {
  return {
    totals: { ...aggregate.totals },
    requests: aggregate.requests,
    cacheHitRate: cacheHitRate(aggregate.totals),
    models: Object.values(aggregate.models)
      .filter(model => model.requests > 0 || totalTokens(model) > 0)
      .sort((left, right) => totalTokens(right) - totalTokens(left)),
    eventCount: aggregate.processed,
    inheritedEventCount: aggregate.inheritedEventCount,
  }
}

function applyModelDelta(aggregate: SessionAggregate, slot: UsageSlot, sign: 1 | -1): void {
  const row = aggregate.models[slot.modelKey] ?? (
    sign > 0
      ? (aggregate.models[slot.modelKey] = {
        key: slot.modelKey,
        provider: slot.provider,
        model: slot.model,
        requests: 0,
        ...emptyBuckets(),
      })
      : undefined
  )
  if (row === undefined) return
  if (sign > 0) addBuckets(row, slot.buckets)
  else subtractBuckets(row, slot.buckets)
  row.requests += sign
  if (row.requests <= 0 && totalTokens(row) <= 0) delete aggregate.models[slot.modelKey]
}

/** Derive first-token latency and generation window from recorded stream times. */
function readTiming(
  data: Record<string, unknown> | undefined,
  stepStart: { turn: number; step: number; time: number } | null,
  turn: number,
  step: number,
  messageTime: number,
): UsageTiming | null {
  let first: number | null = null
  let last: number | null = null
  const stream = data?.stream
  if (Array.isArray(stream)) {
    for (const item of stream) {
      const record = asRecord(item)
      if (record === undefined) continue
      const at = finiteNumber(record.time) ?? finiteNumber(record.time0)
      if (at !== null) {
        first = first === null ? at : Math.min(first, at)
        last = last === null ? at : Math.max(last, at)
      }
      const start = finiteNumber(record.time0)
      if (start !== null) {
        first = first === null ? start : Math.min(first, start)
        const dt = Array.isArray(record.dt) ? record.dt : []
        const elapsed = dt.reduce<number>((sum, value) => sum + (finiteNumber(value) ?? 0), 0)
        last = last === null ? start + elapsed : Math.max(last, start + elapsed)
      }
    }
  }

  const started = stepStart !== null && stepStart.turn === turn && stepStart.step === step
    ? stepStart.time
    : null
  let firstTokenMs: number | null = null
  if (started !== null && first !== null && first >= started) {
    firstTokenMs = first - started
  }
  let generationMs: number | null = null
  if (first !== null && last !== null && last > first) {
    generationMs = last - first
  } else if (started !== null && messageTime > started) {
    generationMs = messageTime - started
  } else if (first !== null && messageTime > first) {
    generationMs = messageTime - first
  }
  const totalMs = firstTokenMs !== null && generationMs !== null
    ? firstTokenMs + generationMs
    : generationMs ?? firstTokenMs
  return firstTokenMs === null && generationMs === null
    ? null
    : { firstTokenMs, generationMs, totalMs }
}

function requestSample(slot: UsageSlot, timing: UsageTiming | null): RequestSample {
  const total = timing?.totalMs ?? null
  const speed = total !== null && total > 0 && slot.buckets.outputTokens > 0
    ? slot.buckets.outputTokens / (total / 1_000)
    : null
  return {
    key: slot.requestKey,
    time: slot.time,
    provider: slot.provider,
    model: slot.model,
    modelKey: slot.modelKey,
    buckets: { ...slot.buckets },
    speed,
    firstToken: timing?.firstTokenMs ?? null,
  }
}

function applyBucketDelta(
  aggregate: SessionAggregate,
  slot: UsageSlot,
  sign: 1 | -1,
  now: number,
  keepHoursMs: number,
): void {
  applyOneBucket(aggregate.days, dayKey(slot.time), slot, sign)
  if (slot.time >= now - keepHoursMs) {
    applyOneBucket(aggregate.hours, hourKey(slot.time), slot, sign)
  }
}

function applyOneBucket(
  buckets: Record<string, UsageBucket>,
  key: string,
  slot: UsageSlot,
  sign: 1 | -1,
): void {
  const existing = buckets[key]
  if (sign < 0) {
    if (existing === undefined) return
    subtractBuckets(existing, slot.buckets)
    existing.requests += sign
    applyBucketModelDelta(existing, slot, sign)
    if (existing.requests <= 0 && totalTokens(existing) <= 0) delete buckets[key]
    return
  }
  const bucket = existing ?? (buckets[key] = { bucket: key, requests: 0, models: [], ...emptyBuckets() })
  addBuckets(bucket, slot.buckets)
  bucket.requests += sign
  applyBucketModelDelta(bucket, slot, sign)
}

function applyBucketModelDelta(bucket: UsageBucket, slot: UsageSlot, sign: 1 | -1): void {
  const index = bucket.models.findIndex(model => model.key === slot.modelKey)
  if (index === -1) {
    if (sign < 0) return
    bucket.models.push({
      key: slot.modelKey,
      provider: slot.provider,
      model: slot.model,
      requests: 1,
      ...slot.buckets,
    })
    return
  }
  const row = bucket.models[index]
  if (row === undefined) return
  if (sign > 0) addBuckets(row, slot.buckets)
  else subtractBuckets(row, slot.buckets)
  row.requests += sign
  if (row.requests <= 0 && totalTokens(row) <= 0) bucket.models.splice(index, 1)
}

function readUsage(event: RawSessionEvent): UsageSample | undefined {
  const data = asRecord(event.data)
  if (data === undefined) return undefined
  if (event.type === 'assistant/message') {
    const direct = asRecord(data.usage)
    if (direct !== undefined) return direct as UsageSample
  }
  const stream = data.stream
  if (!Array.isArray(stream)) return undefined
  for (let index = stream.length - 1; index >= 0; index -= 1) {
    const record = asRecord(stream[index])
    if (record?.type !== 'chunk') continue
    const chunk = asRecord(record.chunk)
    if (chunk?.type !== 'usage') continue
    const usage = asRecord(chunk.usage)
    if (usage !== undefined) return usage as UsageSample
  }
  return undefined
}

function bucketsOf(usage: UsageSample): TokenBuckets {
  return {
    uncachedInputTokens: countOf(usage.inputTokens),
    cacheReadTokens: countOf(usage.cacheReadTokens),
    cacheWriteTokens: countOf(usage.cacheWriteTokens),
    outputTokens: countOf(usage.outputTokens),
  }
}

function identityOf(
  event: RawSessionEvent,
  carry: FoldCarry,
): { provider: string; model: string } {
  if (event.type === 'assistant/message') {
    const data = asRecord(event.data)
    const source = asRecord(asRecord(data?.message)?.source)
    if (source?.kind === 'model') {
      const model = cleanText(source.model)
      if (model !== '') return { provider: cleanText(source.provider), model }
    }
  }
  return { provider: carry.currentProvider, model: carry.currentModel }
}

function isEvent(value: unknown): value is RawSessionEvent {
  const record = asRecord(value)
  return record !== undefined
    && typeof record.type === 'string'
    && typeof record.seq === 'number'
    && Number.isFinite(record.seq)
    && record.seq >= 0
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function countOf(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  return Math.round(value)
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed.length > 160 ? trimmed.slice(0, 160) : trimmed
}
