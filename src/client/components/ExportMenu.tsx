/** Export menu: summary CSV, sessions CSV, and statistics JSON. */

import { createElement as h, useRef, useState } from 'react'
import type { ReactElement } from 'react'

import { Button, Menu, MenuItem } from './common.js'
import { DownloadIcon } from '../icons.js'
import { downloadFile } from '../lib.js'
import type { T } from '../lib.js'
import { sessionsCsv, statsJson, summaryCsv } from '../../shared/export.js'
import type { StatsPayload } from '../../shared/types.js'

export interface ExportMenuProps {
  data: StatsPayload
  t: T
}

export function ExportMenu({ data, t }: ExportMenuProps): ReactElement {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLDivElement | null>(null)
  const close = (): void => setOpen(false)
  const stamp = data.today

  const run = (kind: 'summary' | 'sessions' | 'json'): void => {
    try {
      if (kind === 'summary') {
        downloadFile(`token-dashboard-summary-${stamp}.csv`,
          summaryCsv(data, data.models, data.totals, t('range.all')), 'text/csv')
      } else if (kind === 'sessions') {
        downloadFile(`token-dashboard-sessions-${stamp}.csv`, sessionsCsv(data), 'text/csv')
      } else {
        downloadFile(`token-dashboard-${stamp}.json`, statsJson(data), 'application/json')
      }
    } finally {
      close()
    }
  }

  return h('div', { className: 'tdb-menu-anchor', ref: anchor },
    h(Button, {
      onClick: () => setOpen(current => !current),
      'aria-haspopup': 'menu',
      'aria-expanded': open,
    }, h(DownloadIcon, { size: 14 }), t('actions.export')),
    h(Menu, { open, onClose: close, triggerRef: anchor },
      h(MenuItem, { onClick: () => run('summary'), title: t('export.summary') }),
      h(MenuItem, { onClick: () => run('sessions'), title: t('export.sessions') }),
      h(MenuItem, { onClick: () => run('json'), title: t('export.json') })))
}
