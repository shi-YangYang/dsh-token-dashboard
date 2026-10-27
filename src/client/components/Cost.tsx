/** A collapsed cost row; expands to a short per-model estimate. */

import { createElement as h, useState } from 'react'
import type { ReactElement } from 'react'

import { Button } from './common.js'
import { ChevronDownIcon } from '../icons.js'
import type { T } from '../lib.js'
import { formatNumber } from '../../shared/format.js'
import { estimateCost, formatAmount, type PricingTable } from '../../shared/pricing.js'
import { totalTokens } from '../../shared/model.js'
import type { ModelUsage } from '../../shared/types.js'

export interface CostProps {
  models: readonly ModelUsage[]
  pricing: PricingTable
  t: T
  intl: string | undefined
  onConfigure: () => void
}

export function CostPanel({ models, pricing, t, intl, onConfigure }: CostProps): ReactElement | null {
  const [expanded, setExpanded] = useState(false)
  if (models.length === 0) return null

  const estimate = estimateCost([...models], pricing)
  const totalLabel = estimate.totals.length === 0
    ? null
    : estimate.totals.map(entry => formatAmount(entry.amount, entry.currency)).join(' + ')

  if (totalLabel === null) {
    return h('div', { className: 'tdb-cost' },
      h('div', { className: 'tdb-cost-row', style: { cursor: 'default' } },
        h('span', { className: 'tdb-cost-title' }, t('cost.title')),
        h('span', { className: 'tdb-cost-hint' }, t('cost.none')),
        h('span', { style: { marginLeft: 'auto' } },
          h(Button, { onClick: onConfigure }, t('cost.set')))))
  }

  const head = h('thead', {},
    h('tr', {},
      h('th', {}, t('models.model')),
      h('th', { className: 'tdb-num' }, t('models.total')),
      h('th', { className: 'tdb-num' }, t('cost.title'))))

  const rows = estimate.rows.map(row => h('tr', { key: row.key },
    h('td', {},
      h('div', { className: `tdb-model-name${row.model === '' ? ' tdb-model-unknown' : ''}` },
        row.model === '' ? t('models.unknown') : row.model),
      h('div', { className: 'tdb-model-provider' }, row.provider === '' ? '—' : row.provider)),
    h('td', { className: 'tdb-num' }, formatNumber(totalTokens(row.tokens), intl)),
    h('td', { className: 'tdb-num' },
      row.priced && row.amount !== null && row.currency !== null
        ? formatAmount(row.amount, row.currency)
        : h('span', { className: 'tdb-cost-hint' }, t('cost.notSet')))))

  return h('div', { className: 'tdb-cost' },
    h('button', {
      type: 'button',
      className: 'tdb-cost-row',
      'aria-expanded': expanded,
      onClick: () => setExpanded(value => !value),
    },
    h('span', { className: 'tdb-cost-title' }, t('cost.title')),
    h('span', { className: 'tdb-cost-total' }, totalLabel),
    estimate.unpricedModels > 0
      ? h('span', { className: 'tdb-cost-hint' }, t('cost.unpriced', { count: estimate.unpricedModels }))
      : null,
    h('span', {
      className: 'tdb-cost-chevron',
      style: { transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' },
    }, h(ChevronDownIcon, { size: 14 }))),
    expanded
      ? h('div', { className: 'tdb-cost-body' },
        h('div', { className: 'tdb-table-wrap' },
          h('table', { className: 'tdb-table' }, head, h('tbody', {}, rows))),
        h('div', { className: 'tdb-cost-actions' },
          h(Button, { variant: 'ghost', onClick: onConfigure }, t('cost.manage'))))
      : null)
}
