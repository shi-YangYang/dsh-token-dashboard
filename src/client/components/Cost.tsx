/** Cost summary: a compact row on the overview and a full page on Costs. */

import { createElement as h, useState } from 'react'
import type { ReactElement } from 'react'

import { Button, EmptyState } from './common.js'
import { ChartIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons.js'
import { Section } from './ui/Section.js'
import { DataTable } from './ui/DataTable.js'
import type { DataColumn } from './ui/DataTable.js'
import type { T } from '../lib.js'
import { formatDateTime, formatNumber } from '../../shared/format.js'
import { BUILTIN_PRICE_UPDATED } from '../../shared/builtin-prices.js'
import {
  estimateCost,
  formatAmount,
  type CostEstimate,
  type ModelCostRow,
  type PricingTable,
} from '../../shared/pricing.js'
import { totalTokens } from '../../shared/model.js'
import type { ModelUsage } from '../../shared/types.js'

const PAGE_SIZE = 8

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

/** Compact collapsible cost row, kept for the overview composition. */
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
  const totalLabel = totalLabelOf(estimate)
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
          h('span', { className: 'tdb-cost-hint' }, sourceText(t, intl, onlineAt, onlineSource)),
          h(Button, { variant: 'ghost', busy: refreshingPrices, onClick: onRefreshPrices }, refreshLabel)),
        priceError ? h('div', { className: 'tdb-error-text' }, t('cost.refreshError')) : null,
        h(CostTable, { rows: estimate.rows, t, intl }),
        h('div', { className: 'tdb-cost-actions' },
          h(Button, { variant: 'ghost', onClick: onConfigure }, t('cost.manage'))))
      : null)
}

/** Dedicated Costs page. */
export function CostPage(props: CostProps): ReactElement {
  const { models, pricing, t, intl, onlineAt, onlineSource, refreshingPrices, priceError, onRefreshPrices, onConfigure } = props
  const estimate = estimateCost([...models], pricing)
  const totalLabel = totalLabelOf(estimate)
  const refreshLabel = refreshingPrices ? t('cost.refreshing') : t('cost.refresh')

  return h(Section, {
    title: t('cost.title'),
    ariaLabel: t('cost.title'),
    actions: h('div', { className: 'tdb-cost-actions' },
      h(Button, { variant: 'ghost', busy: refreshingPrices, onClick: onRefreshPrices }, refreshLabel),
      h(Button, { onClick: onConfigure }, t('cost.manage'))),
  },
  models.length === 0
    ? h(EmptyState, { icon: h(ChartIcon, { size: 20 }), title: t('models.empty') })
    : h('div', {},
      h('div', { className: 'tdb-cost-summary' },
        h('div', { className: 'tdb-cost-summary-value' }, totalLabel ?? '—'),
        estimate.unpricedModels > 0
          ? h('span', { className: 'tdb-cost-hint' }, t('cost.unpriced', { count: estimate.unpricedModels }))
          : null),
      h('div', { className: 'tdb-cost-meta' }, sourceText(t, intl, onlineAt, onlineSource)),
      priceError ? h('div', { className: 'tdb-error-text', style: { marginTop: '6px' } }, t('cost.refreshError')) : null,
      h(CostTable, { rows: estimate.rows, t, intl })))
}

function CostTable({ rows, t, intl }: {
  rows: readonly ModelCostRow[]
  t: T
  intl: string | undefined
}): ReactElement {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  return h('div', {},
    h(DataTable<ModelCostRow>, {
      rows: visible,
      columns: costColumns(t, intl),
      rowKey: row => row.key,
      ariaLabel: t('cost.title'),
    }),
    pages > 1
      ? h('div', { className: 'tdb-pager' },
        h('span', {}, t('sessions.page', { page: current + 1, pages })),
        h('div', { className: 'tdb-pager-actions' },
          h(Button, {
            variant: 'ghost',
            iconOnly: true,
            disabled: current <= 0,
            'aria-label': t('sessions.previous'),
            onClick: () => setPage(Math.max(0, current - 1)),
          }, h(ChevronLeftIcon, { size: 15 })),
          h(Button, {
            variant: 'ghost',
            iconOnly: true,
            disabled: current >= pages - 1,
            'aria-label': t('sessions.next'),
            onClick: () => setPage(Math.min(pages - 1, current + 1)),
          }, h(ChevronRightIcon, { size: 15 }))))
      : null)
}

function costColumns(t: T, intl: string | undefined): Array<DataColumn<ModelCostRow>> {
  return [
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
}

function totalLabelOf(estimate: CostEstimate): string | null {
  if (estimate.totals.length === 0) return null
  return estimate.totals.map(entry => formatAmount(entry.amount, entry.currency)).join(' + ')
}

function sourceText(t: T, intl: string | undefined, onlineAt: number, onlineSource: string): string {
  if (onlineAt > 0) {
    return t('cost.onlineSource', {
      source: onlineSource === '' ? 'OpenRouter' : onlineSource,
      when: formatDateTime(onlineAt, intl),
    })
  }
  return t('cost.builtinSource', { date: BUILTIN_PRICE_UPDATED })
}
