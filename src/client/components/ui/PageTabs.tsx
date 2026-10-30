/** Top-level dashboard pages. */

import { createElement as h } from 'react'
import type { ReactElement } from 'react'

export type PageId = 'overview' | 'models' | 'sessions' | 'costs'

export interface PageTab {
  id: PageId
  label: string
}

export interface PageTabsProps {
  items: readonly PageTab[]
  value: PageId
  onChange: (id: PageId) => void
  ariaLabel: string
}

export function PageTabs({ items, value, onChange, ariaLabel }: PageTabsProps): ReactElement {
  return h('div', { className: 'tdb-pagetabs', role: 'tablist', 'aria-label': ariaLabel },
    items.map(item => h('button', {
      key: item.id,
      type: 'button',
      id: `tdb-tab-${item.id}`,
      role: 'tab',
      className: 'tdb-pagetab',
      'aria-selected': value === item.id,
      'aria-controls': 'tdb-page-panel',
      onClick: () => onChange(item.id),
    }, item.label)))
}
