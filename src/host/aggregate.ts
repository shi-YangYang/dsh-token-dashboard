/**
 * Incremental, revision-aware aggregation over every local session.
 *
 * The cache is in memory and derived exclusively from the official logs. It is
 * rebuilt from scratch when the Host process restarts, and every entry is
 * keyed by the persistence revision (or the live session's event count), so a
 * dashboard open never rescans an unchanged log.
 */

import { currentTimezone, hourKey, todayKey } from '../shared/dates.js'
import {
  addBuckets,
  cacheHitRate,
  emptyBuckets,
  sortModels,
  totalTokens,
} from '../shared/model.js'
import type {
  ModelUsage,
  SessionReadError,
  SessionSummary,
  StatsPayload,
  TokenBuckets,
  UsageBucket,
} from '../shared/types.js'
import { API_VERSION } from '../shared/types.js'
import { createAggregate, foldInto, type SessionAggregate } from './fold.js'
import type { AggregatorSource, SessionDescriptor, SessionReadResult } from './source.js'
import type { RawSessionEvent } from './types.js'

interface CacheEntry {
  descriptor: SessionDescriptor
  aggregate: SessionAggregate
  /** Revision token the aggregate was derived from. */
  stamp: string
  /** A stable reason code when the latest read failed; last-good data is kept. */
  failed: string | null
}

interface ScanStats {
  sessionsDiscovered: number
  sessionsRead: number
  sessionsReused: number
  sessionsFailed: number
  durationMs: number
  startedAt: number
}

export interface AggregatorOptions {
  now?: () => number
  concurrency?: number
  keepHoursMs?: number
}

type Plan =
  | { kind: 'reuse' }
  | { kind: 'read'; from: number }

/** Revision-aware token aggregator. One instance per Host plugin activation. */
export class TokenAggregator {
  private readonly source: AggregatorSource
  private readonly now: () => number
  private readonly concurrency: number
  private readonly keepHoursMs: number
  private cache = new Map<string, CacheEntry>()
  private failures: SessionReadError[] = []
  private revision = 0
  private initialized = false
  private refreshing: Promise<void> | null = null
  private payload: StatsPayload | null = null
  private payloadRevision = -1
  private lastScan: ScanStats = {
    sessionsDiscovered: 0,
    sessionsRead: 0,
    sessionsReused: 0,
    sessionsFailed: 0,
    durationMs: 0,
    startedAt: 0,
  }

  constructor(source: AggregatorSource, options: AggregatorOptions = {}) {
    this.source = source
    this.now = options.now ?? Date.now
    this.concurrency = Math.max(1, Math.trunc(options.concurrency ?? 3))
    this.keepHoursMs = options.keepHoursMs ?? 48 * 60 * 60 * 1000
  }

  /** Scan once; a repeated call is a no-op until the next refresh. */
  async ensure(): Promise<void> {
    if (this.initialized) return
    await this.refresh()
  }

  /** Reconcile the cache with the current persisted + live corpus. */
  async refresh(signal?: AbortSignal): Promise<void> {
    if (this.refreshing !== null) {
      await this.refreshing
      return
    }
    const run = this.doRefresh(signal)
    this.refreshing = run.finally(() => {
      this.refreshing = null
    })
    await this.refreshing
  }

  /** Current ETag revision. Bumped only when derived data can have changed. */
  getRevision(): number {
    return this.revision
  }

  /**
   * Read-only per-session fold totals for the diagnostic projection check.
   * The returned buckets are detached copies.
   */
  sessionsForVerification(): Array<{
    id: string
    own: TokenBuckets
    allLog: TokenBuckets
    inheritedEventCount: number
  }> {
    return [...this.cache.values()]
      .map(entry => ({
        id: entry.descriptor.id,
        own: { ...entry.aggregate.totals },
        allLog: { ...entry.aggregate.allTotals },
        inheritedEventCount: entry.aggregate.inheritedEventCount,
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
  }

  get isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Fold one live event without listing or rescanning anything.
   * @returns false when the event is out of sequence and a resync is needed.
   */
  applyLiveEvent(sessionId: string, event: RawSessionEvent): boolean {
    const entry = this.cache.get(sessionId)
    if (entry === undefined || !entry.descriptor.live) return false
    if (entry.failed !== null) return false
    if (!isEvent(event)) return true
    if (event.seq <= entry.aggregate.carry.lastSeq) return true
    if (event.seq !== entry.aggregate.carry.lastSeq + 1) return false
    foldInto(entry.aggregate, [event], { now: this.now(), keepHoursMs: this.keepHoursMs })
    entry.descriptor.seq = Math.max(entry.descriptor.seq, event.seq + 1)
    entry.stamp = `live:${entry.descriptor.seq}`
    entry.failed = null
    this.markChanged()
    return true
  }

  /** Build (or reuse) the wire payload for the dashboard. */
  stats(): StatsPayload {
    const now = this.now()
    const today = todayKey(now)
    if (this.payload !== null && this.payloadRevision === this.revision && this.payload.today === today) {
      return this.payload
    }

    const totals = emptyBuckets()
    let requests = 0
    let liveCount = 0
    let subagentCount = 0
    let seededCount = 0
    let withUsage = 0
    const models = new Map<string, ModelUsage>()
    const days = new Map<string, UsageBucket>()
    const hours = new Map<string, UsageBucket>()
    const rows: SessionSummary[] = []
    const errors: SessionReadError[] = [...this.failures]

    for (const entry of this.cache.values()) {
      const { descriptor, aggregate } = entry
      addBuckets(totals, aggregate.totals)
      requests += aggregate.requests
      for (const model of Object.values(aggregate.models)) {
        mergeModel(models, model)
      }
      for (const bucket of Object.values(aggregate.days)) mergeBucket(days, bucket)
      for (const bucket of Object.values(aggregate.hours)) mergeBucket(hours, bucket)

      const rowModels = sortModels(Object.values(aggregate.models).map(cloneModel))
      const summary: SessionSummary = {
        id: descriptor.id,
        title: aggregate.title,
        project: this.source.projectLabel?.(descriptor.header.cwd) ?? '',
        cwd: descriptor.header.cwd ?? null,
        modelKeys: rowModels.map(model => model.key),
        createdAt: aggregate.createdAt,
        lastActivity: aggregate.lastActivity,
        live: descriptor.live,
        origin: descriptor.header.origin === 'subagent' ? 'subagent' : 'root',
        seeded: descriptor.header.isSeeded === true,
        parentSession: descriptor.header.parentSession ?? null,
        agentPreset: descriptor.header.agentPreset ?? null,
        totals: { ...aggregate.totals },
        requests: aggregate.requests,
        cacheHitRate: cacheHitRate(aggregate.totals),
        models: rowModels,
        eventCount: aggregate.processed,
        inheritedEventCount: aggregate.inheritedEventCount,
        stale: entry.failed !== null,
      }
      rows.push(summary)

      if (descriptor.live) liveCount += 1
      if (summary.origin === 'subagent') subagentCount += 1
      if (summary.seeded) seededCount += 1
      if (summary.requests > 0 || totalTokens(summary.totals) > 0) withUsage += 1
      if (entry.failed !== null) {
        errors.push({ sessionId: descriptor.id, reason: entry.failed })
      }
    }

    rows.sort((left, right) => right.lastActivity - left.lastActivity)

    const uniqueErrors = [...new Map(errors.map(error => [error.sessionId, error])).values()]
    const payload: StatsPayload = {
      apiVersion: API_VERSION,
      revision: this.revision,
      generatedAt: now,
      timezone: currentTimezone(),
      today,
      totals,
      requests,
      cacheHitRate: cacheHitRate(totals),
      sessions: {
        total: rows.length,
        withUsage,
        live: liveCount,
        subagents: subagentCount,
        seeded: seededCount,
      },
      models: sortModels([...models.values()].map(cloneModel)),
      days: [...days.values()].sort((left, right) => left.bucket.localeCompare(right.bucket)),
      hours: [...hours.values()]
        .filter(bucket => bucket.bucket >= hourKey(now - this.keepHoursMs))
        .sort((left, right) => left.bucket.localeCompare(right.bucket)),
      sessionRows: rows,
      scan: {
        ...this.lastScan,
        generatedAt: now,
        partial: uniqueErrors.length > 0,
      },
      errors: uniqueErrors,
    }

    this.payload = payload
    this.payloadRevision = this.revision
    return payload
  }

  private async doRefresh(signal?: AbortSignal): Promise<void> {
    const startedAt = this.now()
    const started = performance.now()
    let descriptors: SessionDescriptor[]
    try {
      descriptors = await this.source.list()
    } catch (error) {
      this.lastScan = {
        sessionsDiscovered: 0,
        sessionsRead: 0,
        sessionsReused: 0,
        sessionsFailed: 0,
        durationMs: Math.round(performance.now() - started),
        startedAt,
      }
      throw error
    }
    throwIfAborted(signal)

    const plans = descriptors.map(descriptor => ({
      descriptor,
      plan: this.planFor(descriptor),
    }))

    let sessionsRead = 0
    let sessionsReused = 0
    let sessionsFailed = 0
    let changed = false
    const next = new Map<string, CacheEntry>()
    const failures: SessionReadError[] = []
    const queue = [...plans]
    let cursor = 0

    const worker = async (): Promise<void> => {
      for (;;) {
        const item = queue[cursor]
        cursor += 1
        if (item === undefined) return
        throwIfAborted(signal)
        const { descriptor } = item
        const previous = this.cache.get(descriptor.id)
        let plan = item.plan

        if (plan.kind === 'reuse') {
          if (previous !== undefined) {
            sessionsReused += 1
            next.set(descriptor.id, {
              descriptor,
              aggregate: previous.aggregate,
              stamp: stampOf(descriptor),
              failed: null,
            })
            continue
          }
          plan = { kind: 'read', from: 0 }
        }

        try {
          const read = await this.source.read(descriptor, plan.from)
          const canAppend = plan.from > 0
            && previous !== undefined
            && read.inheritedEventCount === previous.aggregate.inheritedEventCount
          const aggregate = canAppend
            ? foldTail(previous.aggregate, read, this.now(), this.keepHoursMs)
            : foldFull(read, this.now(), this.keepHoursMs)
          sessionsRead += 1
          changed = true
          next.set(descriptor.id, {
            descriptor: { ...descriptor, seq: Math.max(descriptor.seq, aggregate.processed) },
            aggregate,
            stamp: stampOf(descriptor),
            failed: null,
          })
        } catch {
          sessionsFailed += 1
          failures.push({ sessionId: descriptor.id, reason: 'read-failed' })
          if (previous !== undefined) {
            next.set(descriptor.id, {
              descriptor,
              aggregate: previous.aggregate,
              stamp: stampOf(descriptor),
              failed: 'read-failed',
            })
          }
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(this.concurrency, Math.max(1, queue.length)) }, () => worker()),
    )
    throwIfAborted(signal)

    if (next.size !== this.cache.size) changed = true
    if (!changed) {
      for (const [id, entry] of next) {
        const before = this.cache.get(id)
        if (before !== undefined && before.stamp !== entry.stamp) {
          changed = true
          break
        }
      }
    }

    this.cache = next
    this.failures = failures
    this.lastScan = {
      sessionsDiscovered: descriptors.length,
      sessionsRead,
      sessionsReused,
      sessionsFailed,
      durationMs: Math.round(performance.now() - started),
      startedAt,
    }
    this.initialized = true
    if (changed) this.markChanged()
    else {
      this.payload = null
      this.payloadRevision = -1
    }
  }

  private planFor(descriptor: SessionDescriptor): Plan {
    const entry = this.cache.get(descriptor.id)
    if (entry === undefined || entry.failed !== null) return { kind: 'read', from: 0 }
    if (!sameSessionIdentity(entry.descriptor.header, descriptor.header)) return { kind: 'read', from: 0 }

    if (descriptor.live) {
      if (entry.aggregate.processed === descriptor.seq) return { kind: 'reuse' }
      if (entry.aggregate.processed < descriptor.seq
        && entry.aggregate.inheritedEventCount === descriptor.inheritedEventCount) {
        return { kind: 'read', from: entry.aggregate.processed }
      }
      return { kind: 'read', from: 0 }
    }

    if (entry.descriptor.live) {
      // Live → persisted transition: the live fold already covers the log.
      if (descriptor.eventCount === undefined || entry.aggregate.processed >= descriptor.eventCount) {
        return { kind: 'reuse' }
      }
      return { kind: 'read', from: entry.aggregate.processed }
    }

    if (entry.stamp === stampOf(descriptor)) return { kind: 'reuse' }
    return { kind: 'read', from: 0 }
  }

  private markChanged(): void {
    this.revision += 1
    this.payload = null
    this.payloadRevision = -1
  }
}

function foldFull(read: SessionReadResult, now: number, keepHoursMs: number): SessionAggregate {
  const aggregate = createAggregate(read.header, read.inheritedEventCount)
  foldInto(aggregate, read.events, { now, keepHoursMs })
  return aggregate
}

function foldTail(
  aggregate: SessionAggregate,
  read: SessionReadResult,
  now: number,
  keepHoursMs: number,
): SessionAggregate {
  foldInto(aggregate, read.events, { now, keepHoursMs })
  return aggregate
}

function stampOf(descriptor: SessionDescriptor): string {
  return descriptor.live ? `live:${descriptor.seq}` : `persisted:${descriptor.revision ?? ''}`
}

function sameSessionIdentity(left: SessionHeaderLikeShape, right: SessionHeaderLikeShape): boolean {
  return left.id === right.id
    && left.createdAt === right.createdAt
    && left.cwd === right.cwd
    && left.parentSession === right.parentSession
    && left.isSeeded === right.isSeeded
}

type SessionHeaderLikeShape = {
  readonly id: string
  readonly createdAt?: number
  readonly cwd?: string
  readonly parentSession?: string
  readonly isSeeded?: boolean
}

function mergeBucket(target: Map<string, UsageBucket>, bucket: UsageBucket): void {
  const existing = target.get(bucket.bucket)
  if (existing === undefined) {
    target.set(bucket.bucket, {
      bucket: bucket.bucket,
      requests: bucket.requests,
      models: bucket.models.map(cloneModel),
      ...cloneBuckets(bucket),
    })
    return
  }
  addBuckets(existing, bucket)
  existing.requests += bucket.requests
  for (const model of bucket.models) mergeModelInBucket(existing, model)
}

function mergeModel(target: Map<string, ModelUsage>, model: ModelUsage): void {
  const existing = target.get(model.key)
  if (existing === undefined) {
    target.set(model.key, cloneModel(model))
    return
  }
  addBuckets(existing, model)
  existing.requests += model.requests
}

function mergeModelInBucket(bucket: UsageBucket, model: ModelUsage): void {
  const existing = bucket.models.find(item => item.key === model.key)
  if (existing === undefined) {
    bucket.models.push(cloneModel(model))
    return
  }
  addBuckets(existing, model)
  existing.requests += model.requests
}

function cloneModel(model: ModelUsage): ModelUsage {
  return {
    key: model.key,
    provider: model.provider,
    model: model.model,
    requests: model.requests,
    ...cloneBuckets(model),
  }
}

function cloneBuckets(buckets: TokenBuckets): TokenBuckets {
  return {
    uncachedInputTokens: buckets.uncachedInputTokens,
    cacheReadTokens: buckets.cacheReadTokens,
    cacheWriteTokens: buckets.cacheWriteTokens,
    outputTokens: buckets.outputTokens,
  }
}

function isEvent(value: unknown): value is RawSessionEvent {
  if (value === null || typeof value !== 'object') return false
  const record = value as { type?: unknown; seq?: unknown }
  return typeof record.type === 'string' && typeof record.seq === 'number' && Number.isFinite(record.seq)
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    const error = new Error('aborted')
    error.name = 'AbortError'
    throw error
  }
}
