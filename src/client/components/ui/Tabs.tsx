/** Accessible text tabs used for time ranges and chart views. */

import { createElement as h } from 'react'
import type { ReactElement } from 'react'

export interface SegmentedTab<T extends string> {
  id: T
  label: string
}

export interface SegmentedTabsProps<T extends string> {
  items: readonly SegmentedTab<T>[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
  kind?: 'range' | 'view'
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  kind = 'range',
}: SegmentedTabsProps<T>): ReactElement {
  return h('div', {
    className: kind === 'view' ? 'tdb-view' : 'tdb-range',
    role: 'group',
    'aria-label': ariaLabel,
  }, items.map(item => h('button', {
    key: item.id,
    type: 'button',
    className: kind === 'view' ? 'tdb-view-btn' : 'tdb-range-btn',
    'aria-pressed': value === item.id,
    onClick: () => onChange(item.id),
  }, item.label)))
}
