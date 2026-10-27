/** Page title and the only two global actions: refresh and export. */

import { createElement as h } from 'react'
import type { ReactElement } from 'react'

import { Button } from './common.js'
import { ExportMenu } from './ExportMenu.js'
import { RefreshIcon } from '../icons.js'
import type { T } from '../lib.js'
import type { Language } from '../language.js'
import type { StatsPayload } from '../../shared/types.js'

export interface DashboardHeaderProps {
  t: T
  data: StatsPayload | null
  language: Language
  refreshing: boolean
  showExport: boolean
  onRefresh: () => void
  onChangeLanguage: (language: Language) => void
}

export function DashboardHeader({
  t,
  data,
  language,
  refreshing,
  showExport,
  onRefresh,
  onChangeLanguage,
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
      h(Button, {
        variant: 'ghost',
        iconOnly: true,
        onClick: onRefresh,
        busy: refreshing,
        'aria-label': t('actions.refresh'),
        title: t('actions.refresh'),
      }, h('span', { className: refreshing ? 'tdb-spin' : '' }, h(RefreshIcon, { size: 16 }))),
      showExport && data !== null ? h(ExportMenu, { data, t }) : null))
}
