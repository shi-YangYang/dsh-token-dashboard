/** A titled dashboard section with optional header actions. */

import { createElement as h } from 'react'
import type { ReactElement, ReactNode } from 'react'

export interface SectionProps {
  title: ReactNode
  actions?: ReactNode
  children?: ReactNode
  ariaLabel?: string
  className?: string
}

export function Section({ title, actions, children, ariaLabel, className = '' }: SectionProps): ReactElement {
  return h('section', {
    className: `tdb-section ${className}`.trim(),
    'aria-label': ariaLabel ?? (typeof title === 'string' ? title : undefined),
  },
  h('div', { className: 'tdb-section-head' },
    h('h2', { className: 'tdb-section-title' }, title),
    actions === undefined ? null : h('div', { className: 'tdb-section-actions' }, actions)),
  children)
}
