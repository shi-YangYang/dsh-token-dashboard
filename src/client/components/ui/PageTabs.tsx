/** Top-level dashboard pages, rendered with the beUI Tabs primitive. */

import { createElement as h } from 'react'
import type { ReactElement } from 'react'

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '../../beui/components/motion/tabs.js'

export type PageId = 'overview' | 'models' | 'sessions' | 'requests' | 'costs' | 'pricing'

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
  return h(Tabs as unknown as (props: Record<string, unknown>) => ReactElement, {
    value,
    onValueChange: (next: string) => onChange(next as PageId),
    variant: 'underline',
    children: h(TabsList as unknown as (props: Record<string, unknown>) => ReactElement, {
      className: 'tdb-pagetabs',
      'aria-label': ariaLabel,
      children: items.map(item => h(TabsTrigger as unknown as (props: Record<string, unknown>) => ReactElement, {
        key: item.id,
        value: item.id,
        id: `tdb-tab-${item.id}`,
        className: 'tdb-pagetab',
        indicatorClassName: 'tdb-pagetab-indicator',
        'aria-controls': 'tdb-page-panel',
        children: item.label,
      })),
    }),
  })
}
