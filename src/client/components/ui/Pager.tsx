/** Shared list footer: count + beUI Pagination controls. */

import { createElement as h } from 'react'
import type { ReactElement, ReactNode } from 'react'

import { Pagination } from '../../beui/components/motion/pagination.js'

export interface PagerProps {
  page: number
  pages: number
  onChange: (page: number) => void
  label: ReactNode
  ariaLabel: string
}

export function Pager({ page, pages, onChange, label, ariaLabel }: PagerProps): ReactElement {
  return h('div', { className: 'tdb-pager' },
    h('span', {}, label),
    h('div', { className: 'tdb-pager-actions' },
      h('span', { className: 'sr-only' }, `${page} / ${pages}`),
      h(Pagination as unknown as (props: Record<string, unknown>) => ReactElement, {
        page,
        totalPages: pages,
        onPageChange: onChange,
        siblings: 0,
        boundaries: 1,
        className: 'tdb-beui-pager',
        'aria-label': ariaLabel,
      })))
}
