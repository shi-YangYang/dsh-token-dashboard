/** Mode-scoped KPI row: four values, one quiet sub-line each. */

import { createElement as h } from 'react'
import type { ReactElement } from 'react'

import type { T } from '../lib.js'
import { formatCompact, formatNumber, formatPercent } from '../../shared/format.js'
import { addDays } from '../../shared/dates.js'
import { cacheHitRate, cacheTokens, totalTokens } from '../../shared/model.js'
import { shareOf } from '../../shared/range.js'
import type { HeatMode } from './Heatmap.js'
import type { StatsPayload, TokenBuckets, UsageBucket } from '../../shared/types.js'

export interface KpiCardsProps {
  data: StatsPayload
  mode?: HeatMode
  t: T
  intl: string | undefined
}

export function KpiCards({ data, mode = 'cumulative', t, intl }: KpiCardsProps): ReactElement {
  const period = periodTotals(data, mode)
  const totals = period.totals
  const requests = period.requests
  const hitRate = period.hitRate
  const total = totalTokens(totals)
  const input = totals.uncachedInputTokens
  const output = totals.outputTokens
  const cache = cacheTokens(totals)

  return h('div', { className: 'tdb-kpis' },
    h(Kpi, {
      label: t('kpi.total'),
      value: formatCompact(total, intl),
      exact: formatNumber(total, intl),
      sub: t('kpi.requests', { count: formatNumber(requests, intl) }),
    }),
    h(Kpi, {
      label: t('kpi.input'),
      value: formatCompact(input, intl),
      exact: formatNumber(input, intl),
      sub: t('kpi.share', { share: formatPercent(shareOf(input, total)) }),
    }),
    h(Kpi, {
      label: t('kpi.output'),
      value: formatCompact(output, intl),
      exact: formatNumber(output, intl),
      sub: t('kpi.share', { share: formatPercent(shareOf(output, total)) }),
    }),
    h(Kpi, {
      label: t('kpi.cache'),
      value: formatCompact(cache, intl),
      exact: formatNumber(cache, intl),
      sub: t('kpi.hitRate', { rate: formatPercent(hitRate) }),
    }))
}

function Kpi({ label, value, exact, sub }: { label: string; value: string; exact: string; sub: string }): ReactElement {
  return h('div', { className: 'tdb-kpi' },
    h('div', { className: 'tdb-kpi-label' }, label),
    h('div', { className: 'tdb-kpi-value', title: exact }, value),
    h('div', { className: 'tdb-kpi-sub' }, sub))
}

function periodTotals(data: StatsPayload, mode: HeatMode): {
  totals: TokenBuckets
  requests: number
  hitRate: number
} {
  if (mode === 'cumulative') {
    return { totals: data.totals, requests: data.requests, hitRate: data.cacheHitRate }
  }
  let buckets: readonly UsageBucket[] = []
  if (mode === 'daily') {
    buckets = data.days.filter(bucket => bucket.bucket === data.today)
  } else {
    const today = new Date(`${data.today}T12:00:00Z`)
    const monday = addDays(data.today, -((today.getUTCDay() + 6) % 7))
    buckets = data.days.filter(bucket => bucket.bucket >= monday && bucket.bucket <= data.today)
  }
  const totals = buckets.reduce<TokenBuckets>((sum, bucket) => ({
    uncachedInputTokens: sum.uncachedInputTokens + bucket.uncachedInputTokens,
    cacheReadTokens: sum.cacheReadTokens + bucket.cacheReadTokens,
    cacheWriteTokens: sum.cacheWriteTokens + bucket.cacheWriteTokens,
    outputTokens: sum.outputTokens + bucket.outputTokens,
  }), {
    uncachedInputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
  })
  return {
    totals,
    requests: buckets.reduce((sum, bucket) => sum + bucket.requests, 0),
    hitRate: cacheHitRate(totals),
  }
}
