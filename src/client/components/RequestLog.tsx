/** Billed request log: one row per measured assistant request. */

import { createElement as h, useEffect, useState } from 'react'
import type { ReactElement } from 'react'

import { Button, EmptyState } from './common.js'
import { ChartIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons.js'
import { Section } from './ui/Section.js'
import { DataTable } from './ui/DataTable.js'
import type { DataColumn } from './ui/DataTable.js'
import type { T } from '../lib.js'
import { formatClock, formatFirstToken, formatNumber, formatSpeed } from '../../shared/format.js'
import { costOf, type PricingTable } from '../../shared/pricing.js'
import { fetchRequestPage } from '../lib.js'
import { useAutoPageSize } from '../hooks.js'
import type { RequestLogPage, RequestRecord } from '../../shared/types.js'

export interface RequestLogProps {
  pricing: PricingTable
  t: T
  intl: string | undefined
  refreshToken: string
}

export function RequestLog({ pricing, t, intl, refreshToken }: RequestLogProps): ReactElement {
  const [setPanel, limit] = useAutoPageSize({ initial: 12, min: 12, max: 24 })
  const [page, setPage] = useState(0)
  const [data, setData] = useState<RequestLogPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setPage(0)
  }, [limit])

  useEffect(() => {
    let stopped = false
    setLoading(true)
    setFailed(false)
    fetchRequestPage(page * limit, limit)
      .then(result => {
        if (stopped) return
        setData(result)
        setLoading(false)
        const last = Math.max(0, Math.ceil(result.total / limit) - 1)
        if (page > last) setPage(last)
      })
      .catch(() => {
        if (stopped) return
        setFailed(true)
        setLoading(false)
      })
    return () => { stopped = true }
  }, [page, limit, refreshToken])

  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / limit))
  const current = Math.min(page, pages - 1)

  if (loading && data === null) {
    return h(Section, { ariaLabel: t('tabs.requests') },
      h('div', { className: 'tdb-empty' }, t('requests.loading')))
  }

  if (failed) {
    return h(Section, { ariaLabel: t('tabs.requests') },
      h('div', { className: 'tdb-empty' }, t('requests.failed')))
  }

  if (total === 0) {
    return h(Section, { ariaLabel: t('tabs.requests') },
      h(EmptyState, { icon: h(ChartIcon, { size: 20 }), title: t('requests.empty') }))
  }

  const rows = data?.rows ?? []
  return h(Section, { ariaLabel: t('tabs.requests') },
    h('div', { ref: setPanel, className: 'tdb-table-panel' },
      h(DataTable<RequestRecord>, {
        rows,
        columns: requestColumns(pricing, t, intl),
        rowKey: row => row.id,
        ariaLabel: t('tabs.requests'),
      }),
      h('div', { className: 'tdb-pager' },
        h('span', {}, t('requests.count', { count: formatNumber(total, intl) })),
        h('div', { className: 'tdb-pager-actions' },
          h(Button, {
            variant: 'ghost',
            iconOnly: true,
            disabled: current <= 0,
            'aria-label': t('sessions.previous'),
            onClick: () => setPage(Math.max(0, current - 1)),
          }, h(ChevronLeftIcon, { size: 15 })),
          h('span', {}, t('sessions.page', { page: current + 1, pages })),
          h(Button, {
            variant: 'ghost',
            iconOnly: true,
            disabled: current >= pages - 1,
            'aria-label': t('sessions.next'),
            onClick: () => setPage(Math.min(pages - 1, current + 1)),
          }, h(ChevronRightIcon, { size: 15 }))))))
}

function requestColumns(
  pricing: PricingTable,
  t: T,
  intl: string | undefined,
): Array<DataColumn<RequestRecord>> {
  return [
    {
      key: 'time',
      header: t('requests.time'),
      cellClassName: 'tdb-nowrap',
      render: row => formatClock(row.time, intl),
    },
    {
      key: 'app',
      header: t('requests.app'),
      cellClassName: 'tdb-hide-sm',
      render: row => row.app === '' ? '—' : row.app,
    },
    {
      key: 'provider',
      header: t('requests.provider'),
      headerClassName: 'tdb-hide-md',
      cellClassName: 'tdb-hide-md',
      render: row => row.provider === '' ? '—' : row.provider,
    },
    {
      key: 'model',
      header: t('requests.model'),
      render: row => h('span', { className: 'tdb-session-model', title: row.model },
        row.model === '' ? t('models.unknown') : row.model),
    },
    {
      key: 'input',
      header: t('requests.input'),
      headerClassName: 'tdb-num',
      cellClassName: 'tdb-num',
      render: row => formatNumber(row.inputTokens, intl),
    },
    {
      key: 'output',
      header: t('requests.output'),
      headerClassName: 'tdb-num',
      cellClassName: 'tdb-num',
      render: row => formatNumber(row.outputTokens, intl),
    },
    {
      key: 'cache',
      header: t('requests.cache'),
      headerClassName: 'tdb-num tdb-hide-sm',
      cellClassName: 'tdb-num tdb-hide-sm',
      render: row => formatNumber(row.cacheReadTokens, intl),
    },
    {
      key: 'cost',
      header: t('requests.cost'),
      headerClassName: 'tdb-num',
      cellClassName: 'tdb-num',
      render: row => requestCost(row, pricing),
    },
    {
      key: 'speed',
      header: h('span', { title: t('sessions.speedHint') }, t('sessions.speed')),
      headerClassName: 'tdb-num tdb-hide-sm',
      cellClassName: 'tdb-num tdb-hide-sm',
      render: row => formatSpeed(row.speed),
    },
    {
      key: 'firstToken',
      header: h('span', { title: t('sessions.firstTokenHint') }, t('sessions.firstToken')),
      headerClassName: 'tdb-num tdb-hide-sm',
      cellClassName: 'tdb-num tdb-hide-sm',
      render: row => formatFirstToken(row.firstToken),
    },
  ]
}

function requestCost(row: RequestRecord, pricing: PricingTable): string {
  const price = pricing[row.modelKey]
  const amount = costOf({
    uncachedInputTokens: row.inputTokens,
    cacheReadTokens: row.cacheReadTokens,
    cacheWriteTokens: row.cacheWriteTokens,
    outputTokens: row.outputTokens,
  }, price)
  if (amount === null || price === undefined) return '—'
  return formatRequestAmount(amount, price.currency)
}

function formatRequestAmount(amount: number, currency: string): string {
  const digits = amount !== 0 && Math.abs(amount) < 0.001 ? 6 : 4
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(digits)}`
  }
}
