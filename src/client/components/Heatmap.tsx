/** Token activity heatmap: one year of daily, weekly, or cumulative usage. */

import { createElement as h, useMemo, useRef, useState } from 'react'
import type { FocusEvent as ReactFocusEvent, MouseEvent as ReactMouseEvent, ReactElement } from 'react'

import { Section } from './ui/Section.js'
import { TooltipSurface } from '../beui/components/motion/tooltip-surface.js'
import type { T } from '../lib.js'
import { addDays, enumerateDays } from '../../shared/dates.js'
import { formatCompact, formatNumber } from '../../shared/format.js'
import { totalTokens } from '../../shared/model.js'
import type { StatsPayload, UsageBucket } from '../../shared/types.js'

export type HeatMode = 'daily' | 'weekly' | 'cumulative'

interface DayCell {
  key: string
  bucket: UsageBucket | undefined
  total: number
  requests: number
  value: number
  level: number
}

interface Hover {
  cell: DayCell
  x: number
  y: number
  align: 'left' | 'center' | 'right'
}

interface Calendar {
  weeks: Array<Array<DayCell | null>>
  months: Array<{ week: number; label: string }>
}

export interface HeatmapProps {
  data: StatsPayload
  t: T
  intl: string | undefined
  mode: HeatMode
  onModeChange: (mode: HeatMode) => void
}

export function Heatmap({ data, t, intl, mode, onModeChange }: HeatmapProps): ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const model = useMemo(() => buildCalendar(data, intl), [data, intl])
  const view = useMemo(() => decorate(model, mode), [model, mode])

  const show = (cell: DayCell, element: HTMLElement): void => {
    const root = rootRef.current
    if (root === null) return
    const rect = element.getBoundingClientRect()
    const box = root.getBoundingClientRect()
    const edge = 130
    const center = rect.left - box.left + rect.width / 2
    const align = center < edge ? 'left' : center > box.width - edge ? 'right' : 'center'
    setHover({
      cell,
      x: align === 'left' ? rect.left - box.left : align === 'right' ? rect.right - box.left : center,
      y: rect.top - box.top - 8,
      align,
    })
  }

  const modes: Array<{ id: HeatMode; label: string }> = [
    { id: 'daily', label: t('heatmap.daily') },
    { id: 'weekly', label: t('heatmap.weekly') },
    { id: 'cumulative', label: t('heatmap.cumulative') },
  ]

  const tooltip = hover === null ? null : h('div', {
    className: 'tdb-heatmap-tooltip',
    'data-align': hover.align,
    style: {
      left: hover.x,
      top: hover.y,
      transform: hover.align === 'left'
        ? 'translate(0, -100%)'
        : hover.align === 'right'
          ? 'translate(-100%, -100%)'
          : 'translate(-50%, -100%)',
    },
  },
  h(TooltipSurface as unknown as (props: Record<string, unknown>) => ReactElement, {
    ready: true,
    className: 'tdb-heatmap-tooltip-surface',
    children: h('div', { className: 'tdb-heatmap-tooltip-inner' },
      h('b', {}, hover.cell.key),
      h('span', {}, t('heatmap.tokens', { value: formatNumber(hover.cell.value, intl) })),
      h('span', {}, t('heatmap.requests', { value: formatNumber(hover.cell.requests, intl) }))),
  }))

  const cells = view.weeks.flatMap((week, weekIndex) => week.map((cell, dayIndex) => cell === null
    ? h('span', { key: `${weekIndex}:${dayIndex}:blank`, className: 'tdb-heat-control' })
    : h('span', {
      key: cell.key,
      className: `tdb-heat-cell tdb-heat-cell--${cell.level}`,
      tabIndex: cell.total > 0 ? 0 : -1,
      role: 'img',
      'aria-label': t('heatmap.cellLabel', {
        date: cell.key,
        tokens: formatNumber(cell.value, intl),
        requests: formatNumber(cell.requests, intl),
      }),
      onMouseEnter: (event: ReactMouseEvent<HTMLElement>) => show(cell, event.currentTarget),
      onMouseLeave: () => setHover(null),
      onFocus: (event: ReactFocusEvent<HTMLElement>) => show(cell, event.currentTarget),
      onBlur: () => setHover(null),
    })))

  return h(Section, { ariaLabel: t('heatmap.title'), className: 'tdb-heatmap-section' },
    h('div', { className: 'tdb-heatmap', ref: rootRef },
      h('div', { className: 'tdb-heatmap-head' },
        h('h2', { className: 'tdb-heatmap-title' }, t('heatmap.title')),
        h('div', { className: 'tdb-heatmap-modes', role: 'group', 'aria-label': t('heatmap.modes') },
          modes.map(item => h('button', {
            key: item.id,
            type: 'button',
            className: 'tdb-heatmap-mode',
            'aria-pressed': mode === item.id,
            onClick: () => onModeChange(item.id),
          }, item.label)))),
      h('div', { className: 'tdb-heatmap-scroll' },
        h('div', {
          className: 'tdb-heatmap-grid',
          style: { gridTemplateColumns: `repeat(${view.weeks.length}, minmax(0, 1fr))` },
        }, cells),
        h('div', {
          className: 'tdb-heatmap-month-grid',
          style: { gridTemplateColumns: `repeat(${view.weeks.length}, minmax(0, 1fr))` },
        }, view.months.map(month => h('span', {
          key: `${month.week}:${month.label}`,
          className: 'tdb-heatmap-month',
          style: { gridColumnStart: month.week + 1 },
        }, month.label)))),
      tooltip))
}

function buildCalendar(data: StatsPayload, intl: string | undefined): Calendar {
  const byDay = new Map(data.days.map(bucket => [bucket.bucket, bucket]))
  const end = data.today
  const rawStart = addDays(end, -364)
  const startDate = new Date(`${rawStart}T12:00:00Z`)
  const start = addDays(rawStart, -((startDate.getUTCDay() + 6) % 7))
  const keys = enumerateDays(start, end, 380)
  const dayCells: DayCell[] = keys.map(key => {
    const bucket = byDay.get(key)
    const total = bucket === undefined ? 0 : totalTokens(bucket)
    return {
      key,
      bucket,
      total,
      requests: bucket?.requests ?? 0,
      value: total,
      level: 0,
    }
  })
  const weeks: Array<Array<DayCell | null>> = []
  for (let index = 0; index < dayCells.length; index += 7) {
    const week: Array<DayCell | null> = dayCells.slice(index, index + 7)
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  const months: Array<{ week: number; label: string }> = []
  let lastMonth = -1
  let lastWeek = -10
  weeks.forEach((week, weekIndex) => {
    const first = week.find((cell): cell is DayCell => cell !== null)
    if (first === undefined) return
    const date = new Date(`${first.key}T12:00:00Z`)
    const month = date.getUTCMonth()
    if (month !== lastMonth && weekIndex - lastWeek >= 3) {
      months.push({
        week: weekIndex,
        label: new Intl.DateTimeFormat(intl, { month: 'short' }).format(date),
      })
      lastWeek = weekIndex
    }
    lastMonth = month
  })
  return { weeks, months }
}

function decorate(model: Calendar, mode: HeatMode): Calendar {
  const weekTotals = model.weeks.map(week => week.reduce((sum, cell) => sum + (cell?.total ?? 0), 0))
  let cumulative = 0
  const decorated = model.weeks.map((week, weekIndex) => week.map(cell => {
    if (cell === null) return null
    if (mode === 'cumulative') cumulative += cell.total
    const value = mode === 'weekly'
      ? weekTotals[weekIndex] ?? 0
      : mode === 'cumulative'
        ? cumulative
        : cell.total
    return { ...cell, value }
  }))
  const maximum = decorated.reduce((max, week) => week.reduce((inner, cell) => (
    cell === null ? inner : Math.max(inner, cell.value)
  ), max), 0)
  return {
    months: model.months,
    weeks: decorated.map(week => week.map(cell => {
      if (cell === null) return null
      const level = cell.value === 0 || maximum === 0
        ? 0
        : Math.max(1, Math.min(4, Math.ceil((cell.value / maximum) * 4)))
      return { ...cell, level }
    })),
  }
}
