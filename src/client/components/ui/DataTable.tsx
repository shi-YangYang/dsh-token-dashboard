/** One table renderer for the model, session, and cost tables. */

import { createElement as h } from 'react'
import type {
  CSSProperties,
  KeyboardEvent,
  ReactElement,
  ReactNode,
} from 'react'

export interface DataColumn<T> {
  key: string
  header: ReactNode
  headerClassName?: string
  headerProps?: Record<string, unknown>
  style?: CSSProperties
  cellClassName?: string | ((row: T) => string)
  render: (row: T) => ReactNode
}

export interface DataTableProps<T> {
  rows: readonly T[]
  columns: readonly DataColumn<T>[]
  rowKey: (row: T) => string
  ariaLabel?: string
  rowClassName?: string
  onRowActivate?: (row: T) => void
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  ariaLabel,
  rowClassName,
  onRowActivate,
}: DataTableProps<T>): ReactElement {
  const activate = onRowActivate
  return h('div', { className: 'tdb-table-wrap' },
    h('table', { className: 'tdb-table', 'aria-label': ariaLabel },
      h('thead', {},
        h('tr', {}, columns.map(column => h('th', {
          key: column.key,
          className: column.headerClassName,
          style: column.style,
          ...column.headerProps,
        }, column.header)))),
      h('tbody', {}, rows.map(row => h('tr', {
        key: rowKey(row),
        className: rowClassName ?? (activate === undefined ? undefined : 'tdb-row'),
        tabIndex: activate === undefined ? undefined : 0,
        onClick: activate === undefined ? undefined : () => activate(row),
        onKeyDown: activate === undefined
          ? undefined
          : (event: KeyboardEvent<HTMLTableRowElement>) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            activate(row)
          },
      }, columns.map(column => h('td', {
        key: column.key,
        className: typeof column.cellClassName === 'function'
          ? column.cellClassName(row)
          : column.cellClassName,
      }, column.render(row))))))))
}
