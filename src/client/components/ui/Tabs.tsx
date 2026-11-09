/** Accessible text tabs used for time ranges and chart views. */

import { createElement as h } from 'react'

import {
  Tabs as BeuiTabs,
  TabsList,
  TabsTrigger,
} from '../../beui/components/motion/tabs.js'
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
  return h(BeuiTabs as unknown as (props: Record<string, unknown>) => ReactElement, {
    value,
    onValueChange: (next: string) => onChange(next as T),
    variant: kind === 'view' ? 'segment' : 'pill',
    children: h(TabsList as unknown as (props: Record<string, unknown>) => ReactElement, {
      className: kind === 'view' ? 'tdb-view' : 'tdb-range',
      'aria-label': ariaLabel,
      children: items.map(item => h(TabsTrigger as unknown as (props: Record<string, unknown>) => ReactElement, {
        key: item.id,
        value: item.id,
        className: kind === 'view' ? 'tdb-view-btn' : 'tdb-range-btn',
        'aria-pressed': value === item.id,
        children: item.label,
      })),
    }),
  })
}
