/** The dashboard page: one surface, four numbers, one chart, two tables. */

import { createElement as h, useMemo, useState } from 'react'
import type { ReactElement } from 'react'

import { KpiCards } from './components/Cards.js'
import { CostPanel } from './components/Cost.js'
import { DashboardHeader } from './components/DashboardHeader.js'
import { ModelTable } from './components/Models.js'
import { PricingEditor } from './components/PricingEditor.js'
import { SessionDetail } from './components/SessionDetail.js'
import { SessionTable } from './components/Sessions.js'
import { Trends } from './components/Trends.js'
import { Button, EmptyState, Notice, SkeletonDashboard } from './components/common.js'
import { AlertIcon, DatabaseIcon } from './icons.js'
import { useNow, useStats } from './hooks.js'
import { usePricing } from './usePricing.js'
import { makeT } from './lib.js'
import { setLanguage, useLanguage } from './language.js'
import { en, zh } from './locales.js'
import { totalTokens } from '../shared/model.js'
import { defaultsForModels, mergePricing } from '../shared/pricing.js'
import { CSS } from './styles.js'

export interface DashboardProps {
  onOpenSession?: ((id: string) => void) | undefined
}

export function Dashboard({ onOpenSession }: DashboardProps): ReactElement {
  const language = useLanguage()
  const t = useMemo(
    () => makeT(key => (language === 'zh' ? zh : en)[key] ?? key),
    [language],
  )
  const intl = language === 'zh' ? 'zh-CN' : 'en-US'
  const now = useNow(60_000)
  const stats = useStats()
  const data = stats.data
  const {
    pricing,
    savePricing,
    online,
    onlineSource,
    onlineAt,
    refreshingOnline,
    onlineError,
    refreshOnline,
  } = usePricing()
  const models = useMemo(() => data?.models ?? [], [data])
  const defaults = useMemo(() => defaultsForModels(models, online), [models, online])
  const effectivePricing = useMemo(() => mergePricing(defaults, pricing), [defaults, pricing])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pricingOpen, setPricingOpen] = useState(false)

  const selected = data === null || selectedId === null
    ? null
    : data.sessionRows.find(row => row.id === selectedId) ?? null

  const header = (showExport: boolean): ReactElement => h(DashboardHeader, {
    t,
    data,
    language,
    refreshing: stats.refreshing,
    showExport,
    onRefresh: stats.refresh,
    onChangeLanguage: setLanguage,
  })

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
          header(false),
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
          header(false),
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
        header(true),
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
            pricing: effectivePricing,
            t,
            intl,
            onlineAt,
            onlineSource,
            refreshingPrices: refreshingOnline,
            priceError: onlineError,
            onRefreshPrices: () => { void refreshOnline(data.models) },
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
      defaults,
      t,
      onClose: () => setPricingOpen(false),
      onSave: savePricing,
    }))
}
