/** A collapsed cost row; expands to a short per-model estimate. */

import { createElement as h, useState } from 'react'
import type { ReactElement } from 'react'

import { Button } from './common.js'
import { ChevronDownIcon } from '../icons.js'
import { DataTable } from './ui/DataTable.js'
import type { DataColumn } from './ui/DataTable.js'
import type { T } from '../lib.js'
import { formatDateTime, formatNumber } from '../../shared/format.js'
import { BUILTIN_PRICE_UPDATED } from '../../shared/builtin-prices.js'
import { estimateCost, formatAmount, type ModelCostRow, type PricingTable } from '../../shared/pricing.js'
import { totalTokens } from '../../shared/model.js'
import type { ModelUsage } from '../../shared/types.js'

export interface CostProps {
  models: readonly ModelUsage[]
  pricing: PricingTable
  t: T
  intl: string | undefined
  onlineAt: number
  onlineSource: string
  refreshingPrices: boolean
  priceError: boolean
  onRefreshPrices: () => void
  onConfigure: () => void
}

export function CostPanel({
  models,
  pricing,
  t,
  intl,
  onlineAt,
  onlineSource,
  refreshingPrices,
  priceError,
  onRefreshPrices,
  onConfigure,
}: CostProps): ReactElement | null {
  const [expanded, setExpanded] = useState(false)
  if (models.length === 0) return null

  const estimate = estimateCost([...models], pricing)
  const totalLabel = estimate.totals.length === 0
    ? null
    : estimate.totals.map(entry => formatAmount(entry.amount, entry.currency)).join(' + ')

  const refreshLabel = refreshingPrices ? t('cost.refreshing') : t('cost.refresh')
  if (totalLabel === null) {
    return h('div', { className: 'tdb-cost' },
      h('div', { className: 'tdb-cost-row', style: { cursor: 'default' } },
        h('span', { className: 'tdb-cost-title' }, t('cost.title')),
        h('span', { className: 'tdb-cost-hint' }, t('cost.none')),
        h('span', { className: 'tdb-cost-actions', style: { marginLeft: 'auto' } },
          h(Button, { variant: 'ghost', busy: refreshingPrices, onClick: onRefreshPrices }, refreshLabel),
          h(Button, { onClick: onConfigure }, t('cost.set')))),
      priceError ? h('div', { className: 'tdb-error-text', style: { padding: '0 22px 12px' } }, t('cost.refreshError')) : null)
  }

  const columns: Array<DataColumn<ModelCostRow>> = [
    {
      key: 'model',
      header: t('models.model'),
      render: row => h('div', {},
        h('div', { className: `tdb-model-name${row.model === '' ? ' tdb-model-unknown' : ''}` },
          row.model === '' ? t('models.unknown') : row.model),
        h('div', { className: 'tdb-model-provider' }, row.provider === '' ? '—' : row.provider)),
    },
    {
      key: 'tokens',
      header: t('models.total'),
      headerClassName: 'tdb-num tdb-hide-sm',
      cellClassName: 'tdb-num tdb-hide-sm',
      render: row => formatNumber(totalTokens(row.tokens), intl),
    },
    {
      key: 'cost',
      header: t('cost.title'),
      headerClassName: 'tdb-num',
      cellClassName: 'tdb-num',
      render: row => row.priced && row.amount !== null && row.currency !== null
        ? formatAmount(row.amount, row.currency)
        : h('span', { className: 'tdb-cost-hint' }, t('cost.notSet')),
    },
  ]

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
        h('div', { className: 'tdb-cost-pricebar' },
          h('span', { className: 'tdb-cost-hint' }, onlineAt > 0
            ? t('cost.onlineSource', {
              source: onlineSource === '' ? 'OpenRouter' : onlineSource,
              when: formatDateTime(onlineAt, intl),
            })
            : t('cost.builtinSource', { date: BUILTIN_PRICE_UPDATED })),
          h(Button, { variant: 'ghost', busy: refreshingPrices, onClick: onRefreshPrices }, refreshLabel)),
        priceError ? h('div', { className: 'tdb-error-text' }, t('cost.refreshError')) : null,
        h(DataTable<ModelCostRow>, {
          rows: estimate.rows,
          columns,
          rowKey: row => row.key,
          ariaLabel: t('cost.title'),
        }),
        h('div', { className: 'tdb-cost-actions' },
          h(Button, { variant: 'ghost', onClick: onConfigure }, t('cost.manage'))))
      : null)
}
