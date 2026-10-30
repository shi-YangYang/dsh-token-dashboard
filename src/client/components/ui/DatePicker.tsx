/** Accessible custom date field with a lightweight month calendar. */

import { createElement as h, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'

import { Button } from '../common.js'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '../../icons.js'

export interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  intl?: string
  min?: string
  max?: string
  previousLabel: string
  nextLabel: string
}

interface Position {
  left: number
  top: number
}

export function DatePicker({ value, onChange, ariaLabel, intl, min, max, previousLabel, nextLabel }: DatePickerProps): ReactElement {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [view, setView] = useState(() => monthStart(selectedDate(value) ?? new Date()))
  const trigger = useRef<HTMLButtonElement | null>(null)
  const layer = useRef<HTMLDivElement | null>(null)
  const selected = selectedDate(value)
  const today = isoDate(new Date())

  const place = (): void => {
    const box = trigger.current?.getBoundingClientRect()
    if (box === undefined) return
    const width = Math.min(284, window.innerWidth - 16)
    const below = window.innerHeight - box.bottom - 8
    const above = box.top - 8
    const openUp = below < 340 && above > below
    setPosition({
      left: Math.min(Math.max(8, box.left), Math.max(8, window.innerWidth - width - 8)),
      top: openUp ? Math.max(8, box.top - 336) : box.bottom + 4,
    })
  }

  useEffect(() => {
    if (!open) return
    setView(monthStart(selected ?? new Date()))
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
    // Re-place only when opening; month changes do not move the popup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    layer.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus()
  }, [open, view])

  const choose = (date: Date): void => {
    onChange(isoDate(date))
    setOpen(false)
    trigger.current?.focus()
  }

  const first = new Date(view.getFullYear(), view.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const cells: Array<Date | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, index) => new Date(view.getFullYear(), view.getMonth(), index + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return h('div', { className: 'tdb-date-picker' },
    h('button', {
      ref: trigger,
      type: 'button',
      className: 'tdb-input tdb-date-trigger',
      'aria-label': ariaLabel,
      'aria-haspopup': 'dialog',
      'aria-expanded': open,
      onClick: () => setOpen(current => !current),
    },
    h(CalendarIcon, { size: 14 }),
    h('span', { className: 'tdb-date-value' }, selected === null ? '—' : formatDate(selected, intl))),
    open && position !== null
      ? h('div', {
        ref: layer,
        className: 'tdb-date-popover',
        role: 'dialog',
        'aria-label': ariaLabel,
        style: { left: `${position.left}px`, top: `${position.top}px` },
      },
      h('div', { className: 'tdb-cal-head' },
        h(Button, {
          variant: 'ghost',
          iconOnly: true,
          'aria-label': previousLabel,
          onClick: () => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1)),
        }, h(ChevronLeftIcon, { size: 14 })),
        h('span', { className: 'tdb-cal-title' }, formatMonth(view, intl)),
        h(Button, {
          variant: 'ghost',
          iconOnly: true,
          'aria-label': nextLabel,
          onClick: () => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1)),
        }, h(ChevronRightIcon, { size: 14 }))),
      h('div', { className: 'tdb-cal-grid' },
        ...weekdayLabels(intl).map(label => h('span', { key: `w-${label}`, className: 'tdb-cal-weekday' }, label)),
        ...cells.map((date, index) => {
          if (date === null) return h('span', { key: `blank-${index}`, className: 'tdb-cal-blank' })
          const iso = isoDate(date)
          const disabled = (min !== undefined && iso < min) || (max !== undefined && iso > max)
          return h('button', {
            key: iso,
            type: 'button',
            className: 'tdb-cal-day',
            'data-today': iso === today,
            'aria-pressed': selected !== null && iso === isoDate(selected),
            'aria-label': formatDate(date, intl),
            disabled,
            onClick: () => choose(date),
          }, String(date.getDate()))
        })))
      : null)
}

function selectedDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00`)
  return Number.isFinite(date.getTime()) ? date : null
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function formatDate(date: Date, intl: string | undefined): string {
  try {
    return new Intl.DateTimeFormat(intl, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
  } catch {
    return isoDate(date)
  }
}

function formatMonth(date: Date, intl: string | undefined): string {
  try {
    return new Intl.DateTimeFormat(intl, { year: 'numeric', month: 'long' }).format(date)
  } catch {
    return `${date.getFullYear()}-${date.getMonth() + 1}`
  }
}

function weekdayLabels(intl: string | undefined): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(2024, 0, 1 + index)
    try {
      return new Intl.DateTimeFormat(intl, { weekday: 'short' }).format(date)
    } catch {
      return String(index + 1)
    }
  })
}
