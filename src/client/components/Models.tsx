/** Lifetime model distribution table. */

import { createElement as h } from 'react'
import type { ReactElement } from 'react'

import { EmptyState, ShareBar } from './common.js'
import { ChartIcon } from '../icons.js'
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

export function ModelTable({ models, total, t, intl }: ModelsProps): ReactElement {
  const head = h('thead', {},
    h('tr', {},
      h('th', {}, t('models.model')),
      h('th', { className: 'tdb-num' }, t('models.total')),
      h('th', { className: 'tdb-num tdb-hide-md' }, t('models.input')),
      h('th', { className: 'tdb-num tdb-hide-md' }, t('models.output')),
      h('th', { className: 'tdb-num tdb-hide-md' }, t('models.cache')),
      h('th', { className: 'tdb-num tdb-hide-sm' }, t('models.requests')),
      h('th', { style: { minWidth: '120px' } }, t('models.share'))))

  const rows = models.map(model => {
    const modelTotal = totalTokens(model)
    const share = total <= 0 ? 0 : modelTotal / total
    return h('tr', { key: model.key },
      h('td', {},
        h('div', { className: `tdb-model-name${model.model === '' ? ' tdb-model-unknown' : ''}` },
          model.model === '' ? t('models.unknown') : model.model),
        h('div', { className: 'tdb-model-provider' }, model.provider === '' ? '—' : model.provider)),
      h('td', { className: 'tdb-num' }, formatNumber(modelTotal, intl)),
      h('td', { className: 'tdb-num tdb-hide-md' }, formatNumber(model.uncachedInputTokens, intl)),
      h('td', { className: 'tdb-num tdb-hide-md' }, formatNumber(model.outputTokens, intl)),
      h('td', { className: 'tdb-num tdb-hide-md' }, formatNumber(cacheTokens(model), intl)),
      h('td', { className: 'tdb-num tdb-hide-sm' }, formatNumber(model.requests, intl)),
      h('td', {}, h(ShareBar, { ratio: share, label: formatPercent(share) })))
  })

  return h('section', { className: 'tdb-section', 'aria-label': t('models.title') },
    h('div', { className: 'tdb-section-head' },
      h('h2', { className: 'tdb-section-title' }, t('models.title'))),
    models.length === 0
      ? h(EmptyState, { icon: h(ChartIcon, { size: 20 }), title: t('models.empty') })
      : h('div', { className: 'tdb-table-wrap' },
        h('table', { className: 'tdb-table' }, head, h('tbody', {}, rows))))
}
