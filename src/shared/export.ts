/**
 * Export helpers. Only aggregated statistics are exported: no prompts,
 * assistant text, tool arguments, file contents, credentials, or cwd paths.
 */

import { cacheHitRate, totalTokens } from './model.js'
import type { ModelUsage, StatsPayload, TokenBuckets } from './types.js'

/** Global summary CSV: metrics plus one row per model. */
export function summaryCsv(
  payload: StatsPayload,
  models: ModelUsage[],
  totals: TokenBuckets,
  rangeLabel: string,
): string {
  const total = totalTokens(totals)
  const rows: string[][] = [
    ['Metric', 'Value'],
    ['Generated At', new Date(payload.generatedAt).toISOString()],
    ['Range', rangeLabel],
    ['Timezone', payload.timezone],
    ['Sessions', String(payload.sessions.total)],
    ['Sessions With Usage', String(payload.sessions.withUsage)],
    ['Model Requests', String(payload.requests)],
    ['Total Tokens', String(total)],
    ['Uncached Input Tokens', String(totals.uncachedInputTokens)],
    ['Cache Read Tokens', String(totals.cacheReadTokens)],
    ['Cache Write Tokens', String(totals.cacheWriteTokens)],
    ['Output Tokens', String(totals.outputTokens)],
    ['Cache Hit Rate (%)', (cacheHitRate(totals) * 100).toFixed(2)],
    [],
    [
      'Model',
      'Provider',
      'Total Tokens',
      'Uncached Input Tokens',
      'Cache Read Tokens',
      'Cache Write Tokens',
      'Output Tokens',
      'Requests',
      'Share (%)',
    ],
  ]

  for (const model of models) {
    const modelTotal = totalTokens(model)
    rows.push([
      model.model === '' ? 'Unknown' : model.model,
      model.provider,
      String(modelTotal),
      String(model.uncachedInputTokens),
      String(model.cacheReadTokens),
      String(model.cacheWriteTokens),
      String(model.outputTokens),
      String(model.requests),
      total === 0 ? '0.00' : ((modelTotal / total) * 100).toFixed(2),
    ])
  }

  return `${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

/** Session detail CSV, one row per session, lifetime totals. */
export function sessionsCsv(payload: StatsPayload): string {
  const rows: string[][] = [[
    'Session ID',
    'Title',
    'Project',
    'Models',
    'Created At',
    'Last Activity',
    'Total Tokens',
    'Uncached Input Tokens',
    'Cache Read Tokens',
    'Cache Write Tokens',
    'Output Tokens',
    'Requests',
    'Cache Hit Rate (%)',
    'Live',
    'Origin',
    'Seeded',
  ]]

  for (const session of payload.sessionRows) {
    const models = session.models
      .map(model => (model.model === '' ? 'Unknown' : model.model))
      .join('; ')
    rows.push([
      session.id,
      session.title ?? '',
      session.project,
      models,
      new Date(session.createdAt).toISOString(),
      new Date(session.lastActivity).toISOString(),
      String(totalTokens(session.totals)),
      String(session.totals.uncachedInputTokens),
      String(session.totals.cacheReadTokens),
      String(session.totals.cacheWriteTokens),
      String(session.totals.outputTokens),
      String(session.requests),
      (session.cacheHitRate * 100).toFixed(2),
      session.live ? 'yes' : 'no',
      session.origin,
      session.seeded ? 'yes' : 'no',
    ])
  }

  return `${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

/** Machine-readable Token statistics JSON with cwd fields removed. */
export function statsJson(payload: StatsPayload): string {
  const sanitized: StatsPayload = {
    ...payload,
    sessionRows: payload.sessionRows.map(session => ({ ...session, cwd: null })),
  }
  return `${JSON.stringify(sanitized, null, 2)}\n`
}

/** Escape one CSV cell, including a formula-injection guard. */
export function csvCell(value: string): string {
  let text = value
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}
