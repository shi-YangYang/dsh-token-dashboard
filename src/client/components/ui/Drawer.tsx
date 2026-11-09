/** Right-side detail drawer backed by the beUI Drawer primitive. */

import { createElement as h } from 'react'
import type { ReactElement, ReactNode } from 'react'

import { Button } from '../common.js'
import { CloseIcon } from '../../icons.js'
import { Drawer as BeuiDrawer } from '../../beui/components/motion/drawer.js'

export interface DrawerProps {
  open: boolean
  title: ReactNode
  subtitle?: ReactNode
  badges?: ReactNode
  closeLabel: string
  onClose: () => void
  children?: ReactNode
  footer?: ReactNode
}

export function Drawer({
  open,
  title,
  subtitle,
  badges,
  closeLabel,
  onClose,
  children,
  footer,
}: DrawerProps): ReactElement | null {
  if (!open) return null
  return h(BeuiDrawer as unknown as (props: Record<string, unknown>) => ReactElement, {
    open: true,
    side: 'right',
    ariaLabel: typeof title === 'string' ? title : closeLabel,
    className: 'tdb-drawer',
    onOpenChange: (next: boolean) => {
      if (!next) onClose()
    },
    children: [
      h('div', { key: 'head', className: 'tdb-drawer-head' },
        h('div', { style: { minWidth: 0 } },
          h('h2', { className: 'tdb-drawer-title' }, title),
          subtitle === undefined ? null : h('p', { className: 'tdb-drawer-sub' }, subtitle),
          badges === undefined ? null : h('div', { className: 'tdb-session-badges' }, badges)),
        h(Button, {
          variant: 'ghost',
          iconOnly: true,
          'data-autofocus': true,
          'aria-label': closeLabel,
          onClick: onClose,
        }, h(CloseIcon, { size: 16 }))),
      h('div', { key: 'body', className: 'tdb-drawer-body' }, children),
      footer === undefined ? null : h('div', { key: 'footer', className: 'tdb-drawer-foot' }, footer),
    ],
  })
}
