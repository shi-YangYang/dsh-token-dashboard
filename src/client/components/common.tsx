/** Small host-styled controls shared by the dashboard sections. */

import { createElement as h, useEffect, useRef } from 'react'
import type {
  ButtonHTMLAttributes,
  ChangeEvent,
  MouseEvent as ReactMouseEvent,
  ReactElement,
  ReactNode,
  RefObject,
} from 'react'

import { CloseIcon } from '../icons.js'
import { useModal } from '../hooks.js'

export type ButtonVariant = 'default' | 'primary' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  busy?: boolean
  iconOnly?: boolean
  [dataAttribute: `data-${string}`]: unknown
}

export function Button({
  variant = 'default',
  busy = false,
  iconOnly = false,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps): ReactElement {
  const classes = [
    'tdb-btn',
    variant === 'primary' ? 'tdb-btn--primary' : '',
    variant === 'ghost' ? 'tdb-btn--ghost' : '',
    iconOnly ? 'tdb-btn--icon' : '',
    className,
  ].filter(Boolean).join(' ')
  return h('button', {
    type: 'button',
    ...rest,
    className: classes,
    disabled: disabled === true || busy,
    'aria-busy': busy || undefined,
  }, children)
}

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  value: string
  options: readonly SelectOption[]
  onChange: (value: string) => void
  ariaLabel?: string
  className?: string
}

export function Select({ value, options, onChange, ariaLabel, className = '' }: SelectProps): ReactElement {
  return h('select', {
    className: `tdb-select ${className}`.trim(),
    value,
    'aria-label': ariaLabel,
    onChange: (event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value),
  }, options.map(option => h('option', { key: option.value, value: option.value }, option.label)))
}

export interface TextInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  type?: 'text' | 'date'
  className?: string
  min?: string
  max?: string
}

export function TextInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  type = 'text',
  className = '',
  min,
  max,
}: TextInputProps): ReactElement {
  return h('input', {
    className: `tdb-input ${className}`.trim(),
    type,
    value,
    placeholder,
    'aria-label': ariaLabel,
    min,
    max,
    onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
  })
}

export function Tag({ tone, children }: { tone?: 'live' | 'stale' | 'sub'; children?: ReactNode }): ReactElement {
  const suffix = tone === undefined ? '' : ` tdb-tag--${tone}`
  return h('span', { className: `tdb-tag${suffix}` }, children)
}

export function ShareBar({ ratio, label }: { ratio: number; label: string }): ReactElement {
  const percent = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0
  return h('div', { className: 'tdb-share' },
    h('div', { className: 'tdb-share-track' },
      h('div', { className: 'tdb-share-fill', style: { width: `${(percent * 100).toFixed(2)}%` } })),
    h('span', { className: 'tdb-share-text' }, label))
}

export interface NoticeProps {
  tone?: 'info' | 'warn' | 'error'
  icon?: ReactNode
  children?: ReactNode
  action?: ReactNode
}

export function Notice({ tone = 'info', icon, children, action }: NoticeProps): ReactElement {
  return h('div', { className: `tdb-notice tdb-notice--${tone}`, role: tone === 'error' ? 'alert' : undefined },
    icon,
    h('div', {}, children),
    action === undefined ? null : h('div', { className: 'tdb-notice-actions' }, action))
}

export function EmptyState({ icon, title }: { icon?: ReactNode; title: ReactNode }): ReactElement {
  return h('div', { className: 'tdb-empty' },
    icon ?? null,
    h('div', { style: { color: 'var(--tdb-ink)' } }, title))
}

export function Menu({ open, onClose, triggerRef, children }: {
  open: boolean
  onClose: () => void
  triggerRef?: RefObject<HTMLElement | null>
  children?: ReactNode
}): ReactElement | null {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (ref.current?.contains(target) === true) return
      if (triggerRef?.current?.contains(target) === true) return
      onClose()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, triggerRef])

  if (!open) return null
  return h('div', { className: 'tdb-menu', ref, role: 'menu' }, children)
}

export function MenuItem({ onClick, title }: { onClick: () => void; title: ReactNode }): ReactElement {
  return h('button', { type: 'button', className: 'tdb-menu-item', role: 'menuitem', onClick }, title)
}

export interface ModalProps {
  open: boolean
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  closeLabel: string
  children?: ReactNode
  footer?: ReactNode
}

export function Modal({ open, title, subtitle, onClose, closeLabel, children, footer }: ModalProps): ReactElement | null {
  const ref = useModal(open, onClose)
  if (!open) return null
  return h('div', {
    className: 'tdb-modal-backdrop',
    onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose()
    },
  },
  h('div', {
    className: 'tdb-modal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': typeof title === 'string' ? title : closeLabel,
    ref,
  },
  h('div', { className: 'tdb-modal-head' },
    h('div', {},
      h('h2', { className: 'tdb-modal-title' }, title),
      subtitle === undefined ? null : h('p', { className: 'tdb-modal-sub' }, subtitle)),
    h(Button, {
      variant: 'ghost',
      iconOnly: true,
      'data-autofocus': true,
      'aria-label': closeLabel,
      onClick: onClose,
    }, h(CloseIcon, { size: 16 }))),
  h('div', { className: 'tdb-modal-body' }, children),
  footer === undefined ? null : h('div', { className: 'tdb-modal-foot' }, footer)))
}

export function SkeletonDashboard(): ReactElement {
  return h('div', { className: 'tdb-container', 'aria-busy': 'true' },
    h('div', { className: 'tdb-head' },
      h('div', { className: 'tdb-skeleton', style: { width: '180px', height: '26px' } })),
    h('div', { className: 'tdb-surface' },
      h('div', { className: 'tdb-kpis' },
        h('div', { className: 'tdb-kpi' }, h('div', { className: 'tdb-skeleton', style: { height: '58px' } })),
        h('div', { className: 'tdb-kpi' }, h('div', { className: 'tdb-skeleton', style: { height: '58px' } })),
        h('div', { className: 'tdb-kpi' }, h('div', { className: 'tdb-skeleton', style: { height: '58px' } })),
        h('div', { className: 'tdb-kpi' }, h('div', { className: 'tdb-skeleton', style: { height: '58px' } }))),
      h('div', { className: 'tdb-rule' }),
      h('div', { className: 'tdb-section' }, h('div', { className: 'tdb-skeleton tdb-skeleton--chart' })),
      h('div', { className: 'tdb-rule' }),
      h('div', { className: 'tdb-section' }, h('div', { className: 'tdb-skeleton tdb-skeleton--table' }))))
}
