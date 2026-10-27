/**
 * Diagnostic cross-check: fold result vs token-meter's official `tokenUsage`
 * projection.
 *
 * `ctx.sessionQuery.observeSession(id, { projectionMode: 'all' })` exposes the
 * registered projection values for a persisted session without publishing it.
 * The check reports only ids and four-field buckets; no event content, title,
 * or cwd is returned.
 */

import { bucketsEqual } from '../shared/model.js'
import type { TokenBuckets, VerifyReport } from '../shared/types.js'
import { API_VERSION } from '../shared/types.js'
import type { TokenAggregator } from './aggregate.js'
import type { AggregatorSource } from './source.js'

/** Verify up to `limit` sessions (default 40, hard cap 200). */
export async function verifyAgainstProjection(
  source: AggregatorSource,
  aggregator: TokenAggregator,
  limit = 40,
): Promise<VerifyReport> {
  const report: VerifyReport = {
    apiVersion: API_VERSION,
    checked: 0,
    matched: 0,
    mismatched: 0,
    unsupported: 0,
    matchedBasis: { own: 0, allLog: 0, none: 0 },
    details: [],
    generatedAt: Date.now(),
  }

  if (source.projectUsage === undefined) {
    report.unsupported = aggregator.sessionsForVerification().length
    return report
  }

  const sessions = aggregator.sessionsForVerification().slice(0, clampLimit(limit))
  const concurrency = 2
  let cursor = 0

  const worker = async (): Promise<void> => {
    for (;;) {
      const session = sessions[cursor]
      cursor += 1
      if (session === undefined) return
      let official: TokenBuckets | undefined
      try {
        official = await source.projectUsage?.(session.id)
      } catch {
        official = undefined
      }
      report.checked += 1
      if (official === undefined) {
        report.unsupported += 1
        continue
      }
      const match = bucketsEqual(official, session.own)
        ? 'own'
        : bucketsEqual(official, session.allLog)
          ? 'allLog'
          : 'none'
      if (match === 'none') {
        report.mismatched += 1
        report.matchedBasis.none += 1
      } else {
        report.matched += 1
        report.matchedBasis[match] += 1
      }
      report.details.push({
        sessionId: session.id,
        official,
        own: session.own,
        allLog: session.allLog,
        inheritedEventCount: session.inheritedEventCount,
        match,
      })
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, sessions.length)) }, () => worker()))
  return report
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 40
  return Math.min(200, Math.max(1, Math.trunc(limit)))
}
