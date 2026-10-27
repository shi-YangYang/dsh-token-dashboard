/** Small label/value blocks used by the session drawer. */

import { createElement as h } from 'react'
import type { ReactElement, ReactNode } from 'react'

export function Stat({ label, value, total = false }: {
  label: ReactNode
  value: ReactNode
  total?: boolean
}): ReactElement {
  return h('div', { className: `tdb-detail-stat${total ? ' tdb-detail-stat--total' : ''}` },
    h('div', { className: 'tdb-detail-label' }, label),
    h('div', { className: 'tdb-detail-value' }, value))
}

export function Field({ label, value }: { label: ReactNode; value: ReactNode }): ReactElement {
  return h('div', { className: 'tdb-field' },
    h('div', { className: 'tdb-field-label' }, label),
    h('div', { className: 'tdb-field-value' }, value))
}
