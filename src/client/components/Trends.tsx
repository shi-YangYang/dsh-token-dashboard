/** One usage chart with a range control and three view modes. */

import { createElement as h, useMemo, useState } from 'react'
import type { ReactElement } from 'react'

import { CacheChart, GroupedBars } from './charts.js'
import { TextInput } from './common.js'
import { Section } from './ui/Section.js'
import { SegmentedTabs } from './ui/Tabs.js'
import type { T } from '../lib.js'
import { addDays } from '../../shared/dates.js'
import { formatCompact, formatNumber } from '../../shared/format.js'
import { selectRange } from '../../shared/range.js'
import type { RangeId, RangeSelection } from '../../shared/range.js'
import type { StatsPayload } from '../../shared/types.js'

type View = 'io' | 'cache'

export interface TrendsProps {
  data: StatsPayload
  t: T
  intl: string | undefined
}

export function Trends({ data, t, intl }: TrendsProps): ReactElement {
  const [range, setRange] = useState<RangeSelection>({ id: '30d', from: '', to: '' })
  const [view, setView] = useState<View>('io')

  const result = useMemo(() => selectRange({
    days: data.days,
    hours: data.hours,
    today: data.today,
  }, range), [data, range])

  const rangeTabs: Array<{ id: RangeId; label: string }> = [
    { id: 'today', label: t('range.today') },
    { id: '7d', label: t('range.7d') },
    { id: '30d', label: t('range.30d') },
    { id: '90d', label: t('range.90d') },
    { id: 'all', label: t('range.all') },
    { id: 'custom', label: t('range.custom') },
  ]

  const views: Array<{ id: View; label: string }> = [
    { id: 'io', label: t('trend.io') },
    { id: 'cache', label: t('trend.cache') },
  ]

  const chooseRange = (id: RangeId): void => {
    if (id === 'custom') {
      setRange(current => ({
        id,
        from: current.from === '' ? addDays(data.today, -29) : current.from,
        to: current.to === '' ? data.today : current.to,
      }))
      return
    }
    setRange(current => ({ id, from: current.from, to: current.to }))
  }

  return h(Section, {
    ariaLabel: t('trend.title'),
    actions: h(SegmentedTabs<RangeId>, {
      items: rangeTabs,
      value: range.id,
      onChange: chooseRange,
      ariaLabel: t('range.label'),
    }),
  },
  range.id === 'custom'
    ? h('div', { className: 'tdb-custom-range' },
      h('label', { className: 'tdb-date' },
        t('range.from'),
        h(TextInput, {
          type: 'date',
          value: range.from,
          ariaLabel: t('range.from'),
          onChange: (value: string) => setRange(current => ({ ...current, id: 'custom', from: value })),
        })),
      h('label', { className: 'tdb-date' },
        t('range.to'),
        h(TextInput, {
          type: 'date',
          value: range.to,
          ariaLabel: t('range.to'),
          onChange: (value: string) => setRange(current => ({ ...current, id: 'custom', to: value })),
        })))
    : null,
  h('div', { className: 'tdb-chart-toolbar' },
    h(SegmentedTabs<View>, {
      items: views,
      value: view,
      onChange: setView,
      ariaLabel: t('trend.views'),
      kind: 'view',
    }),
    h('div', { className: 'tdb-chart-summary' },
      t('trend.rangeTotal', {
        tokens: formatCompact(result.totalTokens, intl),
        requests: formatNumber(result.requests, intl),
      }))),
  view === 'io'
    ? h(GroupedBars, { buckets: result.buckets, granularity: result.granularity, t, intl })
    : h(CacheChart, { buckets: result.buckets, granularity: result.granularity, t, intl }),
    h(Legend, {
      items: view === 'io'
        ? [
          { label: t('legend.input'), color: 'var(--tdb-cat-input)' },
          { label: t('legend.output'), color: 'var(--tdb-cat-output)' },
        ]
        : [
          { label: t('legend.cacheRead'), color: 'var(--tdb-cat-cache-read)' },
          { label: t('legend.cacheWrite'), color: 'var(--tdb-cat-cache-write)' },
          { label: t('legend.hitRate'), color: 'var(--tdb-cat-hit)', line: true },
        ],
    }))
}

function Legend({ items }: { items: Array<{ label: string; color: string; line?: boolean }> }): ReactElement {
  return h('div', { className: 'tdb-legend' },
    items.map(item => h('span', { key: item.label, className: 'tdb-legend-item' },
      h('span', {
        className: `tdb-legend-dot${item.line === true ? ' tdb-legend-dot--line' : ''}`,
        style: { background: item.color },
      }),
      item.label)))
}
