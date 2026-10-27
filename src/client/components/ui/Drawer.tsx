/** Right-side detail drawer with focus handling and Escape-to-close. */

import { createElement as h } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactElement, ReactNode } from 'react'

import { Button } from '../common.js'
import { CloseIcon } from '../../icons.js'
import { useModal } from '../../hooks.js'

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
  const ref = useModal(open, onClose)
  if (!open) return null

  return h('div', {
    className: 'tdb-drawer-backdrop',
    onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose()
    },
  },
  h('aside', {
    className: 'tdb-drawer',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': typeof title === 'string' ? title : closeLabel,
    ref,
  },
  h('div', { className: 'tdb-drawer-head' },
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
  h('div', { className: 'tdb-drawer-body' }, children),
  footer === undefined ? null : h('div', { className: 'tdb-drawer-foot' }, footer)))
}
