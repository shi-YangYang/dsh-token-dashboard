/**
 * Hand-built SVG charts. They use no charting dependency, resolve colors from
 * theme tokens, and read the compact buckets the Host already aggregated.
 */

import { createElement as h, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactElement } from 'react'

import { useElementWidth } from '../hooks.js'
import type { T } from '../lib.js'
import { clamp, formatCompact, formatDayLabel, formatPercent } from '../../shared/format.js'
import type { UsageBucket } from '../../shared/types.js'

const HEIGHT = 252
const TOP = 16
const BOTTOM = 28
const LEFT = 44
const RIGHT = 20

type SeriesKey = 'uncachedInputTokens' | 'cacheReadTokens' | 'cacheWriteTokens' | 'outputTokens'

interface Series {
  key: SeriesKey
  label: string
  className: string
}

const STACK: Series[] = [
  { key: 'uncachedInputTokens', label: 'input', className: 'tdb-bar--input' },
  { key: 'cacheReadTokens', label: 'cacheRead', className: 'tdb-bar--cache-read' },
  { key: 'cacheWriteTokens', label: 'cacheWrite', className: 'tdb-bar--cache-write' },
  { key: 'outputTokens', label: 'output', className: 'tdb-bar--output' },
]

export interface ChartProps {
  buckets: readonly UsageBucket[]
  granularity: 'hour' | 'day'
  t: T
  intl: string | undefined
}

interface Hover {
  index: number
  x: number
}

/** Stacked daily/hourly consumption. */
export function StackedBars({ buckets, granularity, t, intl }: ChartProps): ReactElement {
  const [ref, measured] = useElementWidth<HTMLDivElement>()
  const width = Math.max(1, Math.round(measured || 720))
  const [hover, setHover] = useState<Hover | null>(null)
  const innerWidth = Math.max(20, width - LEFT - RIGHT)
  const innerHeight = HEIGHT - TOP - BOTTOM
  const band = innerWidth / Math.max(1, buckets.length)
  const barWidth = clamp(band * 0.64, 1.5, 34)
  const maximum = niceMax(buckets.reduce((sum, bucket) => sum + totalOf(bucket), 0) === 0
    ? 0
    : Math.max(...buckets.map(totalOf)))
  const bottom = TOP + innerHeight

  const toY = (value: number): number => TOP + innerHeight - (value / maximum) * innerHeight
  const xOf = (index: number): number => LEFT + band * index + (band - barWidth) / 2
  const centerOf = (index: number): number => LEFT + band * index + band / 2
  const empty = buckets.every(bucket => totalOf(bucket) === 0)

  const onMove = (event: ReactMouseEvent<SVGSVGElement>): void => {
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width === 0) return
    const x = ((event.clientX - box.left) / box.width) * width
    const index = Math.floor((x - LEFT) / band)
    if (index < 0 || index >= buckets.length) {
      setHover(null)
      return
    }
    setHover({ index, x: centerOf(index) })
  }

  const hovered = hover === null ? undefined : buckets[hover.index]
  const labelOf = (bucket: UsageBucket): string => granularity === 'hour'
    ? `${bucket.bucket.slice(11, 13)}:00`
    : formatDayLabel(bucket.bucket, intl)

  return h('div', { className: 'tdb-chart', ref },
    h('svg', {
      width,
      height: HEIGHT,
      viewBox: `0 0 ${width} ${HEIGHT}`,
      role: 'img',
      'aria-label': t('trend.tokens'),
      className: hover === null ? '' : 'tdb-chart--dim',
      onMouseMove: onMove,
      onMouseLeave: () => setHover(null),
    },
    ...grid(width, maximum, toY, intl),
    h('line', { x1: LEFT, y1: bottom, x2: width - RIGHT, y2: bottom, className: 'tdb-axis-line' }),
    ...buckets.map((bucket, index) => {
      let cursor = 0
      const active = hover?.index === index
      return h('g', { key: bucket.bucket },
        ...STACK.map(series => {
          const value = bucket[series.key]
          const y = toY(cursor + value)
          const height = Math.max(0, toY(cursor) - y)
          cursor += value
          if (height <= 0) return null
          return h('rect', {
            key: series.key,
            x: xOf(index),
            y,
            width: barWidth,
            height,
            className: `tdb-bar ${series.className}${active ? ' tdb-bar--active' : ''}`,
          })
        }))
    }),
    ...xLabels(buckets, band, width, bottom, labelOf),
    hover === null ? null : h(Tooltip, {
      x: clamp(hover.x, 110, width - 110),
      title: hovered === undefined ? '' : `${labelOf(hovered)} · ${formatCompact(totalOf(hovered), intl)}`,
      rows: hovered === undefined ? [] : [
        { label: t('legend.input'), value: formatCompact(hovered.uncachedInputTokens, intl), color: 'var(--tdb-cat-input)' },
        { label: t('legend.cacheRead'), value: formatCompact(hovered.cacheReadTokens, intl), color: 'var(--tdb-cat-cache-read)' },
        { label: t('legend.cacheWrite'), value: formatCompact(hovered.cacheWriteTokens, intl), color: 'var(--tdb-cat-cache-write)' },
        { label: t('legend.output'), value: formatCompact(hovered.outputTokens, intl), color: 'var(--tdb-cat-output)' },
        { label: t('sessions.requests'), value: String(hovered.requests), color: undefined },
      ],
    }),
    empty ? h('div', { className: 'tdb-chart-empty' }, t('trend.empty')) : null))
}

/** Two bars per bucket: uncached input and output. */
export function GroupedBars({ buckets, granularity, t, intl }: ChartProps): ReactElement {
  const [ref, measured] = useElementWidth<HTMLDivElement>()
  const width = Math.max(1, Math.round(measured || 520))
  const [hover, setHover] = useState<Hover | null>(null)
  const innerWidth = Math.max(20, width - LEFT - RIGHT)
  const innerHeight = HEIGHT - TOP - BOTTOM
  const band = innerWidth / Math.max(1, buckets.length)
  const barWidth = clamp(band * 0.28, 1.5, 12)
  const gap = Math.max(1, barWidth * 0.22)
  const maximum = niceMax(Math.max(0, ...buckets.map(bucket => Math.max(bucket.uncachedInputTokens, bucket.outputTokens))))
  const bottom = TOP + innerHeight
  const toY = (value: number): number => TOP + innerHeight - (value / maximum) * innerHeight
  const empty = buckets.every(bucket => bucket.uncachedInputTokens === 0 && bucket.outputTokens === 0)
  const labelOf = (bucket: UsageBucket): string => granularity === 'hour'
    ? `${bucket.bucket.slice(11, 13)}:00`
    : formatDayLabel(bucket.bucket, intl)

  const onMove = (event: ReactMouseEvent<SVGSVGElement>): void => {
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width === 0) return
    const x = ((event.clientX - box.left) / box.width) * width
    const index = Math.floor((x - LEFT) / band)
    if (index < 0 || index >= buckets.length) return setHover(null)
    setHover({ index, x: LEFT + band * index + band / 2 })
  }

  const hovered = hover === null ? undefined : buckets[hover.index]
  return h('div', { className: 'tdb-chart', ref },
    h('svg', {
      width,
      height: HEIGHT,
      viewBox: `0 0 ${width} ${HEIGHT}`,
      role: 'img',
      'aria-label': t('trend.io'),
      onMouseMove: onMove,
      onMouseLeave: () => setHover(null),
    },
    ...grid(width, maximum, toY, intl),
    h('line', { x1: LEFT, y1: bottom, x2: width - RIGHT, y2: bottom, className: 'tdb-axis-line' }),
    ...buckets.map((bucket, index) => {
      const center = LEFT + band * index + band / 2
      const inputHeight = Math.max(0, toY(0) - toY(bucket.uncachedInputTokens))
      const outputHeight = Math.max(0, toY(0) - toY(bucket.outputTokens))
      const active = hover?.index === index
      return h('g', { key: bucket.bucket },
        inputHeight <= 0 ? null : h('rect', {
          x: center - gap / 2 - barWidth,
          y: bottom - inputHeight,
          width: barWidth,
          height: inputHeight,
          rx: Math.min(1.5, barWidth / 2),
          className: `tdb-bar tdb-bar--input${active ? ' tdb-bar--active' : ''}`,
        }),
        outputHeight <= 0 ? null : h('rect', {
          x: center + gap / 2,
          y: bottom - outputHeight,
          width: barWidth,
          height: outputHeight,
          rx: Math.min(1.5, barWidth / 2),
          className: `tdb-bar tdb-bar--output${active ? ' tdb-bar--active' : ''}`,
        }))
    }),
    ...xLabels(buckets, band, width, bottom, labelOf),
    hover === null || hovered === undefined ? null : h(Tooltip, {
      x: clamp(hover.x, 110, width - 110),
      title: labelOf(hovered),
      rows: [
        { label: t('legend.input'), value: formatCompact(hovered.uncachedInputTokens, intl), color: 'var(--tdb-cat-input)' },
        { label: t('legend.output'), value: formatCompact(hovered.outputTokens, intl), color: 'var(--tdb-cat-output)' },
      ],
    }),
    empty ? h('div', { className: 'tdb-chart-empty' }, t('trend.empty')) : null))
}

/** Cache read/write bars plus the per-bucket hit rate line. */
export function CacheChart({ buckets, granularity, t, intl }: ChartProps): ReactElement {
  const [ref, measured] = useElementWidth<HTMLDivElement>()
  const width = Math.max(1, Math.round(measured || 520))
  const [hover, setHover] = useState<Hover | null>(null)
  const right = 42
  const innerWidth = Math.max(20, width - LEFT - right)
  const innerHeight = HEIGHT - TOP - BOTTOM
  const band = innerWidth / Math.max(1, buckets.length)
  const barWidth = clamp(band * 0.54, 1.5, 24)
  const maximum = niceMax(Math.max(0, ...buckets.map(bucket => bucket.cacheReadTokens + bucket.cacheWriteTokens)))
  const bottom = TOP + innerHeight
  const toY = (value: number): number => TOP + innerHeight - (value / maximum) * innerHeight
  const hitY = (ratio: number): number => TOP + innerHeight - clamp(ratio, 0, 1) * innerHeight
  const points = buckets.map((bucket, index) => {
    const prompt = bucket.uncachedInputTokens + bucket.cacheReadTokens + bucket.cacheWriteTokens
    const ratio = prompt === 0 ? 0 : bucket.cacheReadTokens / prompt
    return `${(LEFT + band * index + band / 2).toFixed(2)},${hitY(ratio).toFixed(2)}`
  }).join(' ')
  const empty = buckets.every(bucket => bucket.cacheReadTokens === 0 && bucket.cacheWriteTokens === 0)
  const labelOf = (bucket: UsageBucket): string => granularity === 'hour'
    ? `${bucket.bucket.slice(11, 13)}:00`
    : formatDayLabel(bucket.bucket, intl)

  const onMove = (event: ReactMouseEvent<SVGSVGElement>): void => {
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width === 0) return
    const x = ((event.clientX - box.left) / box.width) * width
    const index = Math.floor((x - LEFT) / band)
    if (index < 0 || index >= buckets.length) return setHover(null)
    setHover({ index, x: LEFT + band * index + band / 2 })
  }

  const hovered = hover === null ? undefined : buckets[hover.index]
  const hoveredRatio = hovered === undefined
    ? 0
    : (() => {
      const prompt = hovered.uncachedInputTokens + hovered.cacheReadTokens + hovered.cacheWriteTokens
      return prompt === 0 ? 0 : hovered.cacheReadTokens / prompt
    })()

  return h('div', { className: 'tdb-chart', ref },
    h('svg', {
      width,
      height: HEIGHT,
      viewBox: `0 0 ${width} ${HEIGHT}`,
      role: 'img',
      'aria-label': t('trend.cache'),
      onMouseMove: onMove,
      onMouseLeave: () => setHover(null),
    },
    ...grid(width, maximum, toY, intl, right),
    h('text', { x: width - right + 6, y: TOP + 3, className: 'tdb-axis-text' }, '100%'),
    h('text', { x: width - right + 6, y: TOP + innerHeight / 2, className: 'tdb-axis-text' }, '50%'),
    h('text', { x: width - right + 6, y: bottom }, '0%'),
    h('line', { x1: LEFT, y1: bottom, x2: width - right, y2: bottom, className: 'tdb-axis-line' }),
    ...buckets.map((bucket, index) => {
      const active = hover?.index === index
      const readHeight = Math.max(0, toY(0) - toY(bucket.cacheReadTokens))
      const writeHeight = Math.max(0, toY(0) - toY(bucket.cacheWriteTokens))
      return h('g', { key: bucket.bucket },
        readHeight <= 0 ? null : h('rect', {
          x: LEFT + band * index + (band - barWidth) / 2,
          y: bottom - readHeight,
          width: barWidth,
          height: readHeight,
          rx: Math.min(1.5, barWidth / 2),
          className: `tdb-bar tdb-bar--cache-read${active ? ' tdb-bar--active' : ''}`,
        }),
        writeHeight <= 0 ? null : h('rect', {
          x: LEFT + band * index + (band - barWidth) / 2,
          y: bottom - readHeight - writeHeight,
          width: barWidth,
          height: writeHeight,
          rx: Math.min(1.5, barWidth / 2),
          className: `tdb-bar tdb-bar--cache-write${active ? ' tdb-bar--active' : ''}`,
        }))
    }),
    buckets.length > 1
      ? h('polyline', { points, className: 'tdb-line-hit' })
      : null,
    ...buckets.map((bucket, index) => {
      const prompt = bucket.uncachedInputTokens + bucket.cacheReadTokens + bucket.cacheWriteTokens
      const ratio = prompt === 0 ? 0 : bucket.cacheReadTokens / prompt
      return h('circle', {
        key: `hit-${bucket.bucket}`,
        cx: LEFT + band * index + band / 2,
        cy: hitY(ratio),
        r: hover?.index === index ? 3.2 : 2,
        className: 'tdb-dot-hit',
      })
    }),
    ...xLabels(buckets, band, width, bottom, labelOf),
    hover === null || hovered === undefined ? null : h(Tooltip, {
      x: clamp(hover.x, 110, width - 110),
      title: labelOf(hovered),
      rows: [
        { label: t('legend.cacheRead'), value: formatCompact(hovered.cacheReadTokens, intl), color: 'var(--tdb-cat-cache-read)' },
        { label: t('legend.cacheWrite'), value: formatCompact(hovered.cacheWriteTokens, intl), color: 'var(--tdb-cat-cache-write)' },
        { label: t('legend.hitRate'), value: formatPercent(hoveredRatio), color: 'var(--tdb-cat-hit)' },
      ],
    }),
    empty ? h('div', { className: 'tdb-chart-empty' }, t('trend.empty')) : null))
}

interface TooltipProps {
  x: number
  title: string
  rows: Array<{ label: string; value: string; color?: string | undefined }>
}

function Tooltip({ x, title, rows }: TooltipProps): ReactElement {
  return h('div', { className: 'tdb-tooltip', style: { left: x, top: 0 } },
    h('div', { className: 'tdb-tooltip-title' }, title),
    rows.map(row => h('div', { key: row.label, className: 'tdb-tooltip-row' },
      h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 5 } },
        row.color === undefined
          ? null
          : h('span', { className: 'tdb-legend-dot', style: { background: row.color } }),
        row.label),
      h('b', {}, row.value))))
}

function grid(
  width: number,
  maximum: number,
  toY: (value: number) => number,
  intl: string | undefined,
  right: number = RIGHT,
): ReactElement[] {
  const lines: ReactElement[] = []
  for (let step = 0; step <= 4; step += 1) {
    const value = (maximum / 4) * step
    const y = toY(value)
    lines.push(h('line', {
      key: `grid-${step}`,
      x1: LEFT,
      y1: y,
      x2: width - right,
      y2: y,
      className: 'tdb-grid-line',
    }))
    lines.push(h('text', {
      key: `axis-${step}`,
      x: LEFT - 8,
      y: y + 3,
      textAnchor: 'end',
      className: 'tdb-axis-text',
    }, formatCompact(value, intl)))
  }
  return lines
}

function xLabels(
  buckets: readonly UsageBucket[],
  band: number,
  width: number,
  bottom: number,
  labelOf: (bucket: UsageBucket) => string,
): ReactElement[] {
  const count = buckets.length
  const step = Math.max(1, Math.ceil(count / Math.max(2, Math.floor((width - LEFT) / 64))))
  const labels: ReactElement[] = []
  buckets.forEach((bucket, index) => {
    if (index % step !== 0 && index !== count - 1) return
    const x = LEFT + band * index + band / 2
    if (index === count - 1 && count > 1 && (count - 1) % step !== 0) {
      const previousX = LEFT + band * (index - step) + band / 2
      if (x - previousX < 46) return
    }
    labels.push(h('text', {
      key: `x-${bucket.bucket}`,
      x,
      y: bottom + 16,
      textAnchor: 'middle',
      className: 'tdb-axis-text',
    }, labelOf(bucket)))
  })
  return labels
}

function totalOf(bucket: UsageBucket): number {
  return bucket.uncachedInputTokens + bucket.cacheReadTokens + bucket.cacheWriteTokens + bucket.outputTokens
}

function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const exponent = Math.floor(Math.log10(value))
  const magnitude = 10 ** exponent
  const normalized = value / magnitude
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  return factor * magnitude
}
