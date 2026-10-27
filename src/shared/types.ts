/**
 * Wire contract shared by the Host aggregator and the browser dashboard.
 *
 * These values describe token accounting only. They never include prompt text,
 * assistant text, tool arguments, file contents, credentials, or raw events.
 */

/** The only wire contract this plugin currently serves. */
export const API_VERSION = 1

/** Same-origin route prefix registered on the Harness web server. */
export const API_PREFIX = '/dsh-token-dashboard'

/** The four disjoint buckets reported by providers and folded by token-meter. */
export interface TokenBuckets {
  /** Provider `inputTokens`: prompt tokens that were neither read from nor written to cache. */
  uncachedInputTokens: number
  /** Provider `cacheReadTokens`: prompt tokens served from the provider cache. */
  cacheReadTokens: number
  /** Provider `cacheWriteTokens`: prompt tokens written to the provider cache. */
  cacheWriteTokens: number
  /** Provider `outputTokens`: generated tokens, reasoning included as the provider reports it. */
  outputTokens: number
}

/** One model (provider + model identity) over some window. */
export interface ModelUsage extends TokenBuckets {
  /** Stable key derived from provider and model id; `unknown` when unidentifiable. */
  key: string
  provider: string
  model: string
  /** Number of billed attempts attributed to this model. */
  requests: number
}

/** One time bucket (a local calendar day or a local hour). */
export interface UsageBucket extends TokenBuckets {
  /** `YYYY-MM-DD` for days, `YYYY-MM-DDTHH` for hours. */
  bucket: string
  requests: number
  models: ModelUsage[]
}

/** One session row in the dashboard table. */
export interface SessionSummary {
  id: string
  /** Latest log-backed `session/title`, or null when the log has none. */
  title: string | null
  /** Human-readable project label: the workspace title when known, else the cwd basename. */
  project: string
  /** Absolute working directory, or null when the session has none. */
  cwd: string | null
  /** Model keys that contributed usage in this session. */
  modelKeys: string[]
  createdAt: number
  lastActivity: number
  live: boolean
  origin: 'root' | 'subagent'
  /** True when this session's log inherited a prefix from another session. */
  seeded: boolean
  parentSession: string | null
  agentPreset: string | null
  totals: TokenBuckets
  requests: number
  cacheHitRate: number
  models: ModelUsage[]
  eventCount: number
  inheritedEventCount: number
  /** A newer log revision could not be read; the row shows the last good fold. */
  stale: boolean
}

/** One failed session read. Only an id and a stable reason code are exposed. */
export interface SessionReadError {
  sessionId: string
  reason: string
}

/** What the last aggregation pass did. */
export interface ScanReport {
  /** Sessions currently visible (live + persisted). */
  sessionsDiscovered: number
  /** Sessions whose log was actually read during the pass. */
  sessionsRead: number
  /** Sessions served from the in-memory revision cache. */
  sessionsReused: number
  sessionsFailed: number
  durationMs: number
  /** Epoch ms when the pass started. */
  startedAt: number
  /** Epoch ms when the payload was produced. */
  generatedAt: number
  /** True when at least one session could not be read. */
  partial: boolean
}

/** The complete dashboard payload. */
export interface StatsPayload {
  apiVersion: number
  revision: number
  generatedAt: number
  /** IANA time zone used for day/hour bucketing. */
  timezone: string
  /** Today's local calendar date, `YYYY-MM-DD`. */
  today: string
  totals: TokenBuckets
  /** Total billed attempts across all sessions. */
  requests: number
  cacheHitRate: number
  sessions: {
    total: number
    withUsage: number
    live: number
    subagents: number
    seeded: number
  }
  models: ModelUsage[]
  days: UsageBucket[]
  /** Only the trailing 48 hours, so "today" can render an hourly chart. */
  hours: UsageBucket[]
  sessionRows: SessionSummary[]
  scan: ScanReport
  errors: SessionReadError[]
}

/** Cross-check of this plugin's fold against token-meter's `tokenUsage` projection. */
export interface VerifyReport {
  apiVersion: number
  checked: number
  matched: number
  mismatched: number
  unsupported: number
  /** Fold result that matched the official projection, per checked session group. */
  matchedBasis: { own: number; allLog: number; none: number }
  details: Array<{
    sessionId: string
    official: TokenBuckets
    own: TokenBuckets
    allLog: TokenBuckets
    inheritedEventCount: number
    match: 'own' | 'allLog' | 'none'
  }>
  generatedAt: number
}
