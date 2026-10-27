/** Lifetime KPI row: four values, one quiet sub-line each. */

import { createElement as h } from 'react'
import type { ReactElement } from 'react'

import type { T } from '../lib.js'
import { formatCompact, formatNumber, formatPercent } from '../../shared/format.js'
import { cacheTokens, totalTokens } from '../../shared/model.js'
import { shareOf } from '../../shared/range.js'
import type { StatsPayload } from '../../shared/types.js'

export interface KpiCardsProps {
  data: StatsPayload
  t: T
  intl: string | undefined
}

export function KpiCards({ data, t, intl }: KpiCardsProps): ReactElement {
  const total = totalTokens(data.totals)
  const input = data.totals.uncachedInputTokens
  const output = data.totals.outputTokens
  const cache = cacheTokens(data.totals)

  return h('div', { className: 'tdb-kpis' },
    h(Kpi, {
      label: t('kpi.total'),
      value: formatCompact(total, intl),
      exact: formatNumber(total, intl),
      sub: t('kpi.requests', { count: formatNumber(data.requests, intl) }),
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
      sub: t('kpi.hitRate', { rate: formatPercent(data.cacheHitRate) }),
    }))
}

function Kpi({ label, value, exact, sub }: { label: string; value: string; exact: string; sub: string }): ReactElement {
  return h('div', { className: 'tdb-kpi' },
    h('div', { className: 'tdb-kpi-label' }, label),
    h('div', { className: 'tdb-kpi-value', title: exact }, value),
    h('div', { className: 'tdb-kpi-sub' }, sub))
}
