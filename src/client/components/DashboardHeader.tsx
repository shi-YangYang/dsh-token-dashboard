/** Page title and the only two global actions: refresh and export. */

import { createElement as h } from 'react'
import type { ReactElement } from 'react'

import { Button } from './common.js'
import { ExportMenu } from './ExportMenu.js'
import { RefreshIcon } from '../icons.js'
import type { T } from '../lib.js'
import type { StatsPayload } from '../../shared/types.js'

export interface DashboardHeaderProps {
  t: T
  data: StatsPayload | null
  refreshing: boolean
  showExport: boolean
  onRefresh: () => void
}

export function DashboardHeader({
  t,
  data,
  refreshing,
  showExport,
  onRefresh,
}: DashboardHeaderProps): ReactElement {
  return h('header', { className: 'tdb-head' },
    h('h1', { className: 'tdb-title' }, t('panel.title')),
    h('div', { className: 'tdb-actions' },
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
