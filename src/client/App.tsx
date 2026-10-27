/** The dashboard page: one surface, four numbers, one chart, two tables. */

import { createElement as h, useMemo, useState } from 'react'
import type { ReactElement } from 'react'

import { KpiCards } from './components/Cards.js'
import { CostPanel } from './components/Cost.js'
import { ExportMenu } from './components/ExportMenu.js'
import { ModelTable } from './components/Models.js'
import { PricingEditor } from './components/PricingEditor.js'
import { SessionDetail } from './components/SessionDetail.js'
import { SessionTable } from './components/Sessions.js'
import { Trends } from './components/Trends.js'
import { Button, EmptyState, Notice, SkeletonDashboard } from './components/common.js'
import { AlertIcon, DatabaseIcon, RefreshIcon } from './icons.js'
import { useLocaleSnapshot, useNow, useStats } from './hooks.js'
import { NS, PRICING_KEY, intlLocaleOf, makeT } from './lib.js'
import type { LocaleLike } from './lib.js'
import { totalTokens } from '../shared/model.js'
import { parsePricing, serializePricing, type PricingTable } from '../shared/pricing.js'
import { CSS } from './styles.js'

export interface DashboardProps {
  locale: LocaleLike
  onOpenSession?: ((id: string) => void) | undefined
}

export function Dashboard({ locale, onOpenSession }: DashboardProps): ReactElement {
  const snapshot = useLocaleSnapshot(locale)
  const t = useMemo(() => makeT(locale.bind(NS)), [locale, snapshot])
  const intl = intlLocaleOf(snapshot)
  const now = useNow(60_000)
  const stats = useStats()
  const data = stats.data

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pricingOpen, setPricingOpen] = useState(false)
  const [pricing, setPricing] = useState<PricingTable>(() => {
    try {
      return parsePricing(localStorage.getItem(PRICING_KEY))
    } catch {
      return {}
    }
  })

  const selected = data === null || selectedId === null
    ? null
    : data.sessionRows.find(row => row.id === selectedId) ?? null

  const savePricing = (table: PricingTable): void => {
    setPricing(table)
    try {
      localStorage.setItem(PRICING_KEY, serializePricing(table))
    } catch {
      // Private mode: the in-memory table still applies.
    }
  }

  const head = (withExport: boolean): ReactElement => h('header', { className: 'tdb-head' },
    h('h1', { className: 'tdb-title' }, t('panel.title')),
    h('div', { className: 'tdb-actions' },
      h(Button, {
        variant: 'ghost',
        iconOnly: true,
        onClick: stats.refresh,
        busy: stats.refreshing,
        'aria-label': t('actions.refresh'),
        title: t('actions.refresh'),
      }, h('span', { className: stats.refreshing ? 'tdb-spin' : '' }, h(RefreshIcon, { size: 16 }))),
      withExport && data !== null ? h(ExportMenu, { data, t }) : null))

  if (stats.loading && data === null) {
    return h('div', { className: 'tdb-root' },
      h('style', { key: 'tdb-styles' }, CSS),
      h('div', { className: 'tdb-scroll' }, h(SkeletonDashboard)))
  }

  if (data === null) {
    return h('div', { className: 'tdb-root' },
      h('style', { key: 'tdb-styles' }, CSS),
      h('div', { className: 'tdb-scroll' },
        h('div', { className: 'tdb-container' },
          head(false),
          h('div', { className: 'tdb-surface' },
            h('div', { className: 'tdb-section' },
              h(Notice, {
                tone: 'error',
                icon: h(AlertIcon, { size: 16 }),
                action: h(Button, { onClick: stats.refresh }, t('errors.retry')),
              }, t('errors.title')))))))
  }

  if (data.sessions.total === 0) {
    return h('div', { className: 'tdb-root' },
      h('style', { key: 'tdb-styles' }, CSS),
      h('div', { className: 'tdb-scroll' },
        h('div', { className: 'tdb-container' },
          head(false),
          h('div', { className: 'tdb-surface' },
            h('div', { className: 'tdb-section' },
              h(EmptyState, { icon: h(DatabaseIcon, { size: 22 }), title: t('sessions.empty') }))))))
  }

  const problem = data.errors.length > 0
    ? t('errors.partial', { count: data.errors.length })
    : stats.pollError !== null
      ? t('errors.poll')
      : null

  return h('div', { className: 'tdb-root' },
    h('style', { key: 'tdb-styles' }, CSS),
    h('div', { className: 'tdb-scroll' },
      h('div', { className: 'tdb-container' },
        head(true),
        problem === null
          ? null
          : h(Notice, { tone: 'warn', icon: h(AlertIcon, { size: 15 }) }, problem),
        h('div', { className: 'tdb-surface' },
          h(KpiCards, { data, t, intl }),
          h('div', { className: 'tdb-rule' }),
          h(Trends, { data, t, intl }),
          h('div', { className: 'tdb-rule' }),
          h(ModelTable, { models: data.models, total: totalTokens(data.totals), t, intl }),
          h('div', { className: 'tdb-rule' }),
          h(SessionTable, {
            rows: data.sessionRows,
            t,
            intl,
            now,
            onSelect: session => setSelectedId(session.id),
          }),
          h(CostPanel, {
            models: data.models,
            pricing,
            t,
            intl,
            onConfigure: () => setPricingOpen(true),
          })))),
    h(SessionDetail, {
      session: selected,
      t,
      intl,
      onClose: () => setSelectedId(null),
      onOpen: onOpenSession === undefined
        ? undefined
        : (id: string) => {
          onOpenSession(id)
          setSelectedId(null)
        },
    }),
    h(PricingEditor, {
      open: pricingOpen,
      models: data.models,
      pricing,
      t,
      onClose: () => setPricingOpen(false),
      onSave: savePricing,
    }))
}
