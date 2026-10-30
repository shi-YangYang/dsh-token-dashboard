/** Accessible, theme-native select trigger and fixed listbox. */

import { createElement as h, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactElement } from 'react'

import { CheckIcon, ChevronDownIcon } from '../../icons.js'

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

interface Position {
  left: number
  top: number
  width: number
  maxHeight: number
}

export function Select({ value, options, onChange, ariaLabel, className = '' }: SelectProps): ReactElement {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState<Position | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const layer = useRef<HTMLDivElement | null>(null)
  const listId = useId()
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value))
  const selected = options.find(option => option.value === value) ?? options[0]

  const place = (): void => {
    const box = trigger.current?.getBoundingClientRect()
    if (box === undefined) return
    const estimated = Math.min(280, options.length * 32 + 10)
    const below = window.innerHeight - box.bottom - 8
    const above = box.top - 8
    const openUp = below < Math.min(estimated, 180) && above > below
    const maxHeight = Math.max(80, Math.min(280, openUp ? above : below))
    const width = Math.max(box.width, 160)
    setPosition({
      left: Math.min(Math.max(8, box.left), Math.max(8, window.innerWidth - width - 8)),
      top: openUp ? Math.max(8, box.top - Math.min(estimated, maxHeight) - 4) : box.bottom + 4,
      width,
      maxHeight,
    })
  }

  useEffect(() => {
    if (!open) return
    place()
    const onPointer = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (layer.current?.contains(target) === true || trigger.current?.contains(target) === true) return
      setOpen(false)
    }
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      trigger.current?.focus()
    }
    const onScroll = (event: Event): void => {
      const target = event.target
      if (target instanceof Node && layer.current?.contains(target) === true) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
    // `options.length` participates through the placement estimate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    const node = layer.current?.querySelector<HTMLElement>(`[data-active="true"]`)
    node?.focus()
  }, [open, active])

  const openMenu = (): void => {
    setActive(selectedIndex)
    setOpen(true)
  }

  const choose = (option: SelectOption): void => {
    onChange(option.value)
    setOpen(false)
    trigger.current?.focus()
  }

  const move = (delta: number): void => {
    if (options.length === 0) return
    setActive(index => (index + delta + options.length) % options.length)
  }

  const onLayerKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActive(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActive(options.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const option = options[active]
      if (option !== undefined) choose(option)
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return h('div', { className: `tdb-select-wrap ${className}`.trim() },
    h('button', {
      ref: trigger,
      type: 'button',
      className: 'tdb-select tdb-select-trigger',
      'aria-label': ariaLabel,
      'aria-haspopup': 'listbox',
      'aria-expanded': open,
      'aria-controls': open ? listId : undefined,
      onClick: () => {
        if (open) setOpen(false)
        else openMenu()
      },
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          if (open) move(event.key === 'ArrowUp' ? -1 : 1)
          else openMenu()
        }
      },
    },
    h('span', { className: 'tdb-select-label' }, selected?.label ?? value),
    h(ChevronDownIcon, { size: 13 })),
    open && position !== null
      ? h('div', {
        ref: layer,
        id: listId,
        className: 'tdb-select-menu',
        role: 'listbox',
        'aria-label': ariaLabel,
        tabIndex: -1,
        style: {
          left: `${position.left}px`,
          top: `${position.top}px`,
          width: `${position.width}px`,
          maxHeight: `${position.maxHeight}px`,
        },
        onKeyDown: onLayerKeyDown,
      },
      options.map((option, index) => h('button', {
        key: option.value,
        type: 'button',
        role: 'option',
        'aria-selected': option.value === value,
        'data-active': index === active,
        tabIndex: index === active ? 0 : -1,
        className: 'tdb-select-option',
        onClick: () => choose(option),
      },
      h('span', { className: 'tdb-select-option-label' }, option.label),
      option.value === value ? h(CheckIcon, { size: 13 }) : null)))
      : null)
}
