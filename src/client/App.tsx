/** The dashboard page: one surface, four numbers, one chart, two tables. */

import { Fragment, createElement as h, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'

import { KpiCards } from './components/Cards.js'
import { CostPage } from './components/Cost.js'
import { DashboardHeader } from './components/DashboardHeader.js'
import { ModelTable } from './components/Models.js'
import { PricingPage } from './components/PricingPage.js'
import { SessionDetail } from './components/SessionDetail.js'
import { SessionTable } from './components/Sessions.js'
import { RequestLog } from './components/RequestLog.js'
import { Heatmap } from './components/Heatmap.js'
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
import { builtinPriceRows } from '../shared/builtin-prices.js'
import { SCAN_INTERVAL_MS, readScanInterval, saveScanInterval, type ScanInterval } from './scan.js'
import { CSS } from './styles.js'
import { BEUI_CSS } from './beui-css.js'

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
  const builtinRows = useMemo(() => builtinPriceRows(), [])
  const builtinModels = useMemo(() => builtinRows.map(row => ({
    key: row.key,
    provider: row.provider,
    model: row.model,
    requests: 0,
    uncachedInputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
  })), [builtinRows])
  const builtinDefaults = useMemo(() => Object.fromEntries(
    builtinRows.map(row => [row.key, row.price]),
  ), [builtinRows])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState<PageId>('overview')
  const [requestRefresh, setRequestRefresh] = useState(0)
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
  const selected = data === null || selectedId === null
    ? null
    : data.sessionRows.find(row => row.id === selectedId) ?? null

  const pageTabs = [
    { id: 'overview' as const, label: t('tabs.overview') },
    { id: 'models' as const, label: t('tabs.models') },
    { id: 'sessions' as const, label: t('tabs.sessions') },
    { id: 'requests' as const, label: t('tabs.requests') },
    { id: 'costs' as const, label: t('tabs.costs') },
    { id: 'pricing' as const, label: t('tabs.pricing') },
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
      h('style', { key: 'tdb-styles' }, CSS + BEUI_CSS),
      h('div', { className: 'tdb-scroll' }, h(SkeletonDashboard)))
  }

  if (data === null) {
    return h('div', { className: 'tdb-root' },
      h('style', { key: 'tdb-styles' }, CSS + BEUI_CSS),
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
      h('style', { key: 'tdb-styles' }, CSS + BEUI_CSS),
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
    h('style', { key: 'tdb-styles' }, CSS + BEUI_CSS),
    h('div', { className: 'tdb-scroll' },
      h('div', { className: 'tdb-container' },
        header(true),
        problem === null
          ? null
          : h(Notice, { tone: 'warn', icon: h(AlertIcon, { size: 15 }) }, problem),
        h('div', { className: `tdb-surface tdb-surface--pages${page === 'overview' ? ' tdb-surface--compact' : ''}` },
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
              h(KpiCards, { data, t, intl }),
              h('div', { className: 'tdb-rule' }),
              h(Heatmap, { data, t, intl }))
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
                  : page === 'pricing'
                    ? h(PricingPage, {
                      models: builtinModels,
                      pricing,
                      defaults: builtinDefaults,
                      t,
                      onSave: savePricing,
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
    )
}
