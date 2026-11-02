/** The dashboard page: one surface, four numbers, one chart, two tables. */

import { Fragment, createElement as h, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'

import { KpiCards } from './components/Cards.js'
import { CostPage } from './components/Cost.js'
import { DashboardHeader } from './components/DashboardHeader.js'
import { ModelTable } from './components/Models.js'
import { PricingEditor } from './components/PricingEditor.js'
import { SessionDetail } from './components/SessionDetail.js'
import { SessionTable } from './components/Sessions.js'
import { RequestLog } from './components/RequestLog.js'
import { Trends } from './components/Trends.js'
import type { ChartView } from './components/Trends.js'
import { PageTabs } from './components/ui/PageTabs.js'
import type { PageId } from './components/ui/PageTabs.js'
import { Button, EmptyState, Notice, SkeletonDashboard } from './components/common.js'
import { AlertIcon, DatabaseIcon } from './icons.js'
import { useNow, useStats } from './hooks.js'
import { usePricing } from './usePricing.js'
import { makeT } from './lib.js'
import { setLanguage, useLanguage } from './language.js'
import { en, zh } from './locales.js'
import { totalTokens } from '../shared/model.js'
import { defaultsForModels, mergePricing } from '../shared/pricing.js'
import { selectRange } from '../shared/range.js'
import type { RangeSelection } from '../shared/range.js'
import { SCAN_INTERVAL_MS, readScanInterval, saveScanInterval, type ScanInterval } from './scan.js'
import { CSS } from './styles.js'

const AUTO_PRICE_SYNC_MS = 6 * 60 * 60 * 1_000
const AUTO_PRICE_INITIAL_DELAY_MS = 3_000

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
  const [scanInterval, setScanInterval] = useState<ScanInterval>(readScanInterval)
  const stats = useStats(SCAN_INTERVAL_MS[scanInterval])
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
  const [page, setPage] = useState<PageId>('overview')
  const [requestRefresh, setRequestRefresh] = useState(0)
  const [range, setRange] = useState<RangeSelection>({ id: '30d', from: '', to: '' })
  const [chartView, setChartView] = useState<ChartView>('io')
  const priceModelsRef = useRef(models)
  const onlineRef = useRef(online)
  const onlineAtRef = useRef(onlineAt)
  const refreshPricesRef = useRef(refreshOnline)
  priceModelsRef.current = models
  onlineRef.current = online
  onlineAtRef.current = onlineAt
  refreshPricesRef.current = refreshOnline
  const priceModelKey = useMemo(
    () => [...new Set(models.map(model => model.model))].sort().join('|'),
    [models],
  )

  useEffect(() => {
    if (priceModelsRef.current.length === 0) return
    let stopped = false
    let inFlight = false
    const sync = async (): Promise<void> => {
      if (stopped || inFlight) return
      const current = priceModelsRef.current
      if (current.length === 0) return
      const names = [...new Set(current.map(model => model.model.trim().toLowerCase()).filter(name => name !== ''))]
      const fresh = onlineAtRef.current > 0 && Date.now() - onlineAtRef.current < AUTO_PRICE_SYNC_MS
      const missing = names.some(name => onlineRef.current[name] === undefined)
      if (fresh && !missing) return
      inFlight = true
      try {
        await refreshPricesRef.current(current, { force: false, silent: true })
      } finally {
        inFlight = false
      }
    }
    const initial = setTimeout(() => { void sync() }, AUTO_PRICE_INITIAL_DELAY_MS)
    const timer = setInterval(() => { void sync() }, AUTO_PRICE_SYNC_MS)
    return () => {
      stopped = true
      clearTimeout(initial)
      clearInterval(timer)
    }
  }, [priceModelKey])
  const rangeResult = useMemo(() => selectRange({
    days: data?.days ?? [],
    hours: data?.hours ?? [],
    today: data?.today ?? '',
  }, range), [data, range])

  const selected = data === null || selectedId === null
    ? null
    : data.sessionRows.find(row => row.id === selectedId) ?? null

  const pageTabs = [
    { id: 'overview' as const, label: t('tabs.overview') },
    { id: 'models' as const, label: t('tabs.models') },
    { id: 'sessions' as const, label: t('tabs.sessions') },
    { id: 'requests' as const, label: t('tabs.requests') },
    { id: 'costs' as const, label: t('tabs.costs') },
  ]
  const refreshAll = (): void => {
    stats.refresh()
    setRequestRefresh(value => value + 1)
  }
  const changePage = (next: PageId): void => {
    setPage(next)
    if (next !== 'sessions') setSelectedId(null)
  }

  const header = (showExport: boolean): ReactElement => h(DashboardHeader, {
    t,
    data,
    language,
    refreshing: stats.refreshing,
    showExport,
    onRefresh: refreshAll,
    onChangeLanguage: setLanguage,
    scanInterval,
    onScanIntervalChange: (value: ScanInterval) => {
      setScanInterval(value)
      saveScanInterval(value)
    },
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
        h('div', { className: 'tdb-surface tdb-surface--pages' },
          h(PageTabs, {
            items: pageTabs,
            value: page,
            onChange: changePage,
            ariaLabel: t('tabs.label'),
          }),
          h('div', {
            key: page,
            id: 'tdb-page-panel',
            className: 'tdb-page',
            role: 'tabpanel',
            'aria-labelledby': `tdb-tab-${page}`,
          },
          page === 'overview'
            ? h(Fragment, {},
              h(KpiCards, { data, result: rangeResult, t, intl }),
              h('div', { className: 'tdb-rule' }),
              h(Trends, {
                data,
                result: rangeResult,
                range,
                view: chartView,
                onRangeChange: setRange,
                onViewChange: setChartView,
                t,
                intl,
              }))
            : page === 'models'
              ? h(ModelTable, { models: data.models, total: totalTokens(data.totals), t, intl })
              : page === 'sessions'
                ? h(SessionTable, {
                  rows: data.sessionRows,
                  t,
                  intl,
                  now,
                  onSelect: session => setSelectedId(session.id),
                })
                : page === 'requests'
                  ? h(RequestLog, {
                    pricing: effectivePricing,
                    t,
                    intl,
                    refreshToken: `${data.revision}:${requestRefresh}`,
                  })
                  : h(CostPage, {
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
                  autoSync: true,
                }))))),
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
