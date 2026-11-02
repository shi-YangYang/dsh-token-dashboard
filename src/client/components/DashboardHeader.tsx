/** Page title and the only two global actions: refresh and export. */

import { createElement as h } from 'react'
import type { ReactElement } from 'react'

import { Button } from './common.js'
import { ExportMenu } from './ExportMenu.js'
import { Select } from './ui/Select.js'
import { RefreshIcon } from '../icons.js'
import type { T } from '../lib.js'
import type { Language } from '../language.js'
import { SCAN_INTERVALS, type ScanInterval } from '../scan.js'
import type { StatsPayload } from '../../shared/types.js'

export interface DashboardHeaderProps {
  t: T
  data: StatsPayload | null
  language: Language
  refreshing: boolean
  showExport: boolean
  onRefresh: () => void
  onChangeLanguage: (language: Language) => void
  scanInterval: ScanInterval
  onScanIntervalChange: (value: ScanInterval) => void
}

export function DashboardHeader({
  t,
  data,
  language,
  refreshing,
  showExport,
  onRefresh,
  onChangeLanguage,
  scanInterval,
  onScanIntervalChange,
}: DashboardHeaderProps): ReactElement {
  return h('header', { className: 'tdb-head' },
    h('h1', { className: 'tdb-title' }, t('panel.title')),
    h('div', { className: 'tdb-actions' },
      h('div', { className: 'tdb-lang-switch', role: 'group', 'aria-label': t('language.switch') },
        h('button', {
          type: 'button',
          className: 'tdb-lang-choice',
          'aria-pressed': language === 'zh',
          onClick: () => onChangeLanguage('zh'),
        }, '中文'),
        h('button', {
          type: 'button',
          className: 'tdb-lang-choice',
          'aria-pressed': language === 'en',
          onClick: () => onChangeLanguage('en'),
        }, 'EN')),
      h('div', { className: 'tdb-scan-top' },
        h(Select, {
          value: scanInterval,
          options: SCAN_INTERVALS.map(value => ({ value, label: t(`scan.${value}`) })),
          onChange: value => onScanIntervalChange(value as ScanInterval),
          ariaLabel: t('scan.label'),
          className: 'tdb-scan-top-select',
        }),
        t('scan.suffix') === ''
          ? null
          : h('span', { className: 'tdb-scan-suffix' }, t('scan.suffix'))),
      h(Button, {
        variant: 'ghost',
        onClick: onRefresh,
        busy: refreshing,
        'aria-label': t('actions.syncNow'),
        title: t('actions.syncNow'),
      }, h('span', { className: refreshing ? 'tdb-spin' : '' }, h(RefreshIcon, { size: 15 })),
        h('span', { className: 'tdb-sync-now-label' }, t('actions.syncNow'))),
      showExport && data !== null ? h(ExportMenu, { data, t }) : null))
}
