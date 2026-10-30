/** Lifetime model distribution table. */

import { createElement as h, useState } from 'react'
import type { ReactElement } from 'react'

import { Button, EmptyState, ShareBar } from './common.js'
import { ChartIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons.js'
import { Section } from './ui/Section.js'
import { DataTable } from './ui/DataTable.js'
import type { DataColumn } from './ui/DataTable.js'
import type { T } from '../lib.js'
import { formatNumber, formatPercent } from '../../shared/format.js'
import { cacheTokens, totalTokens } from '../../shared/model.js'
import type { ModelUsage } from '../../shared/types.js'

export interface ModelsProps {
  models: readonly ModelUsage[]
  total: number
  t: T
  intl: string | undefined
}

const PAGE_SIZE = 10

export function ModelTable({ models, total, t, intl }: ModelsProps): ReactElement {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(models.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = models.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)
  const columns: Array<DataColumn<ModelUsage>> = [
    {
      key: 'model',
      header: t('models.model'),
      render: model => h('div', {},
        h('div', { className: `tdb-model-name${model.model === '' ? ' tdb-model-unknown' : ''}` },
          model.model === '' ? t('models.unknown') : model.model),
        h('div', { className: 'tdb-model-provider' }, model.provider === '' ? '—' : model.provider)),
    },
    {
      key: 'total',
      header: t('models.total'),
      headerClassName: 'tdb-num',
      cellClassName: 'tdb-num',
      render: model => formatNumber(totalTokens(model), intl),
    },
    {
      key: 'input',
      header: t('models.input'),
      headerClassName: 'tdb-num tdb-hide-md',
      cellClassName: 'tdb-num tdb-hide-md',
      render: model => formatNumber(model.uncachedInputTokens, intl),
    },
    {
      key: 'output',
      header: t('models.output'),
      headerClassName: 'tdb-num tdb-hide-md',
      cellClassName: 'tdb-num tdb-hide-md',
      render: model => formatNumber(model.outputTokens, intl),
    },
    {
      key: 'cache',
      header: t('models.cache'),
      headerClassName: 'tdb-num tdb-hide-md',
      cellClassName: 'tdb-num tdb-hide-md',
      render: model => formatNumber(cacheTokens(model), intl),
    },
    {
      key: 'requests',
      header: t('models.requests'),
      headerClassName: 'tdb-num tdb-hide-sm',
      cellClassName: 'tdb-num tdb-hide-sm',
      render: model => formatNumber(model.requests, intl),
    },
    {
      key: 'share',
      header: t('models.share'),
      headerClassName: 'tdb-hide-sm',
      cellClassName: 'tdb-hide-sm',
      style: { minWidth: '100px' },
      render: model => {
        const share = total <= 0 ? 0 : totalTokens(model) / total
        return h(ShareBar, { ratio: share, label: formatPercent(share) })
      },
    },
  ]

  return h(Section, { title: t('models.title'), ariaLabel: t('models.title') },
    models.length === 0
      ? h(EmptyState, { icon: h(ChartIcon, { size: 20 }), title: t('models.empty') })
      : h('div', { className: 'tdb-table-panel' },
        h(DataTable<ModelUsage>, {
          rows: visible,
          columns,
          rowKey: model => model.key,
          ariaLabel: t('models.title'),
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
          : null))
}
