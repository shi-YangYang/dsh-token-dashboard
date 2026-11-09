/** DSH-themed wrapper around the beUI compound Select. */

import { createElement as h } from 'react'
import type { ReactElement } from 'react'

import {
  Select as BeuiSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../beui/components/motion/select.js'

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
  const selected = options.find(option => option.value === value) ?? options[0]
  return h(BeuiSelect as unknown as (props: Record<string, unknown>) => ReactElement, {
    value,
    onValueChange: onChange,
    className: `tdb-select-wrap ${className}`.trim(),
    children: [
      h(SelectTrigger as unknown as (props: Record<string, unknown>) => ReactElement, {
        key: 'trigger',
        className: 'tdb-select-trigger',
        ariaLabel,
        children: h(SelectValue as unknown as (props: Record<string, unknown>) => ReactElement, {
          placeholder: selected?.label ?? value,
        }),
      }),
      h(SelectContent as unknown as (props: Record<string, unknown>) => ReactElement, {
        key: 'content',
        className: 'tdb-select-menu',
        children: options.map(option => h(SelectItem as unknown as (props: Record<string, unknown>) => ReactElement, {
          key: option.value,
          value: option.value,
          className: 'tdb-select-option',
          children: option.label,
        })),
      }),
    ],
  })
}
