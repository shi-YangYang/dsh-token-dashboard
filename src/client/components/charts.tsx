/**
 * Hand-built SVG charts. They use no charting dependency, resolve colors from
 * theme tokens, and read the compact buckets the Host already aggregated.
 */

import { createElement as h, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactElement } from 'react'

import { useElementSize } from '../hooks.js'
import type { T } from '../lib.js'
import { clamp, formatCompact, formatDayLabel, formatPercent } from '../../shared/format.js'
import type { UsageBucket } from '../../shared/types.js'

const DEFAULT_HEIGHT = 252
const MIN_HEIGHT = 220
const TOP = 16
const BOTTOM = 28
const LEFT = 44
const RIGHT = 20
const INTERVALS = 5

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
  y: number
}

interface Scale {
  maximum: number
  step: number
}

interface BarPart {
  series: Series
  y: number
  height: number
}

/** Stacked daily/hourly consumption. */
export function StackedBars({ buckets, granularity, t, intl }: ChartProps): ReactElement {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const width = Math.max(1, Math.round(size.width || 720))
  const height = Math.max(MIN_HEIGHT, Math.round(size.height || DEFAULT_HEIGHT))
  const [hover, setHover] = useState<Hover | null>(null)
  const innerWidth = Math.max(20, width - LEFT - RIGHT)
  const innerHeight = height - TOP - BOTTOM
  const band = innerWidth / Math.max(1, buckets.length)
  const barWidth = clamp(band * 0.62, 0.5, 42)
  const rawMax = buckets.reduce((maximum, bucket) => Math.max(maximum, totalOf(bucket)), 0)
  const scale = niceScale(rawMax)
  const bottom = TOP + innerHeight
  const toY = (value: number): number => TOP + innerHeight - (value / scale.maximum) * innerHeight
  const centerOf = (index: number): number => LEFT + band * index + band / 2
  const xOf = (index: number): number => centerOf(index) - barWidth / 2
  const empty = rawMax === 0

  const onMove = (event: ReactMouseEvent<SVGSVGElement>): void => {
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return
    const x = ((event.clientX - box.left) / box.width) * width
    const y = ((event.clientY - box.top) / box.height) * height
    const index = Math.floor((x - LEFT) / band)
    if (index < 0 || index >= buckets.length) {
      setHover(null)
      return
    }
    setHover({ index, x: centerOf(index), y })
  }

  const hovered = hover === null ? undefined : buckets[hover.index]
  const labelOf = (bucket: UsageBucket): string => granularity === 'hour'
    ? `${bucket.bucket.slice(11, 13)}:00`
    : formatDayLabel(bucket.bucket, intl)

  return h('div', { className: 'tdb-chart', ref },
    h('svg', {
      width,
      height,
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': t('trend.tokens'),
      onMouseMove: onMove,
      onMouseLeave: () => setHover(null),
    },
    ...grid(width, scale, toY, intl),
    h('line', { x1: LEFT, y1: bottom, x2: width - RIGHT, y2: bottom, className: 'tdb-axis-line' }),
    hover === null ? null : h('rect', {
      className: 'tdb-hover-band',
      x: LEFT + band * hover.index,
      y: TOP,
      width: band,
      height: innerHeight,
      rx: Math.min(4, band / 2),
    }),
    ...buckets.map((bucket, index) => {
      let cursor = 0
      const parts: BarPart[] = []
      for (const series of STACK) {
        const value = bucket[series.key]
        const top = toY(cursor + value)
        let height = Math.max(0, toY(cursor) - top)
        cursor += value
        if (value <= 0 || height <= 0) continue
        let y = top
        if (height < 1) {
          y = Math.max(TOP, toY(cursor) - 1)
          height = toY(cursor) - y
          if (height <= 0) continue
        }
        parts.push({ series, y, height })
      }
      const cap = parts[parts.length - 1]
      return h('g', { key: bucket.bucket },
        ...parts.map(part => part === cap
          ? h('path', {
            key: part.series.key,
            d: topRoundedPath(xOf(index), part.y, barWidth, part.height, 3),
            className: `tdb-bar ${part.series.className}`,
          })
          : h('rect', {
            key: part.series.key,
            x: xOf(index),
            y: part.y,
            width: barWidth,
            height: part.height,
            className: `tdb-bar ${part.series.className}`,
          })))
    }),
    ...xLabels(buckets, band, width, bottom, labelOf),
    hover === null ? null : h(Tooltip, {
      x: tooltipX(hover.x, width),
      y: tooltipY(hover.y, height),
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
  const [ref, size] = useElementSize<HTMLDivElement>()
  const width = Math.max(1, Math.round(size.width || 520))
  const height = Math.max(MIN_HEIGHT, Math.round(size.height || DEFAULT_HEIGHT))
  const [hover, setHover] = useState<Hover | null>(null)
  const innerWidth = Math.max(20, width - LEFT - RIGHT)
  const innerHeight = height - TOP - BOTTOM
  const band = innerWidth / Math.max(1, buckets.length)
  const available = Math.max(0.5, band * 0.86)
  const barWidth = Math.min(22, available * 0.42)
  const gap = Math.max(0.2, Math.min(barWidth * 0.2, available - 2 * barWidth))
  const rawMax = buckets.reduce(
    (maximum, bucket) => Math.max(maximum, bucket.uncachedInputTokens, bucket.outputTokens),
    0,
  )
  const scale = niceScale(rawMax)
  const bottom = TOP + innerHeight
  const toY = (value: number): number => TOP + innerHeight - (value / scale.maximum) * innerHeight
  const empty = rawMax === 0
  const labelOf = (bucket: UsageBucket): string => granularity === 'hour'
    ? `${bucket.bucket.slice(11, 13)}:00`
    : formatDayLabel(bucket.bucket, intl)

  const onMove = (event: ReactMouseEvent<SVGSVGElement>): void => {
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return
    const x = ((event.clientX - box.left) / box.width) * width
    const y = ((event.clientY - box.top) / box.height) * height
    const index = Math.floor((x - LEFT) / band)
    if (index < 0 || index >= buckets.length) return setHover(null)
    setHover({ index, x: LEFT + band * index + band / 2, y })
  }

  const hovered = hover === null ? undefined : buckets[hover.index]
  return h('div', { className: 'tdb-chart', ref },
    h('svg', {
      width,
      height,
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': t('trend.io'),
      onMouseMove: onMove,
      onMouseLeave: () => setHover(null),
    },
    ...grid(width, scale, toY, intl),
    h('line', { x1: LEFT, y1: bottom, x2: width - RIGHT, y2: bottom, className: 'tdb-axis-line' }),
    hover === null ? null : h('rect', {
      className: 'tdb-hover-band',
      x: LEFT + band * hover.index,
      y: TOP,
      width: band,
      height: innerHeight,
      rx: Math.min(4, band / 2),
    }),
    ...buckets.map((bucket, index) => {
      const center = LEFT + band * index + band / 2
      const inputHeight = visibleHeight(bucket.uncachedInputTokens, toY, bottom)
      const outputHeight = visibleHeight(bucket.outputTokens, toY, bottom)
      return h('g', { key: bucket.bucket },
        inputHeight <= 0 ? null : h('rect', {
          x: center - gap / 2 - barWidth,
          y: bottom - inputHeight,
          width: barWidth,
          height: inputHeight,
          rx: Math.min(2.5, barWidth / 2),
          className: 'tdb-bar tdb-bar--input',
        }),
        outputHeight <= 0 ? null : h('rect', {
          x: center + gap / 2,
          y: bottom - outputHeight,
          width: barWidth,
          height: outputHeight,
          rx: Math.min(2.5, barWidth / 2),
          className: 'tdb-bar tdb-bar--output',
        }))
    }),
    ...xLabels(buckets, band, width, bottom, labelOf),
    hover === null || hovered === undefined ? null : h(Tooltip, {
      x: tooltipX(hover.x, width),
      y: tooltipY(hover.y, height),
      title: labelOf(hovered),
      rows: [
        { label: t('legend.input'), value: formatCompact(hovered.uncachedInputTokens, intl), color: 'var(--tdb-cat-input)' },
        { label: t('legend.output'), value: formatCompact(hovered.outputTokens, intl), color: 'var(--tdb-cat-output)' },
        { label: t('legend.total'), value: formatCompact(hovered.uncachedInputTokens + hovered.outputTokens, intl), color: undefined },
        { label: t('sessions.requests'), value: String(hovered.requests), color: undefined },
      ],
    }),
    empty ? h('div', { className: 'tdb-chart-empty' }, t('trend.emptyIo')) : null))
}

/** Cache read/write bars plus the per-bucket hit rate line. */
export function CacheChart({ buckets, granularity, t, intl }: ChartProps): ReactElement {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const width = Math.max(1, Math.round(size.width || 520))
  const height = Math.max(MIN_HEIGHT, Math.round(size.height || DEFAULT_HEIGHT))
  const [hover, setHover] = useState<Hover | null>(null)
  const right = 42
  const innerWidth = Math.max(20, width - LEFT - right)
  const innerHeight = height - TOP - BOTTOM
  const band = innerWidth / Math.max(1, buckets.length)
  const barWidth = clamp(band * 0.5, 0.5, 26)
  const rawMax = buckets.reduce(
    (maximum, bucket) => Math.max(maximum, bucket.cacheReadTokens + bucket.cacheWriteTokens),
    0,
  )
  const scale = niceScale(rawMax)
  const bottom = TOP + innerHeight
  const toY = (value: number): number => TOP + innerHeight - (value / scale.maximum) * innerHeight
  const hitY = (ratio: number): number => TOP + innerHeight - clamp(ratio, 0, 1) * innerHeight
  const empty = rawMax === 0
  const labelOf = (bucket: UsageBucket): string => granularity === 'hour'
    ? `${bucket.bucket.slice(11, 13)}:00`
    : formatDayLabel(bucket.bucket, intl)

  const onMove = (event: ReactMouseEvent<SVGSVGElement>): void => {
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return
    const x = ((event.clientX - box.left) / box.width) * width
    const y = ((event.clientY - box.top) / box.height) * height
    const index = Math.floor((x - LEFT) / band)
    if (index < 0 || index >= buckets.length) return setHover(null)
    setHover({ index, x: LEFT + band * index + band / 2, y })
  }

  const hitPoints = buckets.map((bucket, index) => {
    const prompt = promptOf(bucket)
    if (prompt <= 0) return null
    return {
      index,
      x: LEFT + band * index + band / 2,
      y: hitY(bucket.cacheReadTokens / prompt),
    }
  })
  const segments: string[] = []
  let run: string[] = []
  for (const point of hitPoints) {
    if (point === null) {
      if (run.length > 1) segments.push(run.join(' '))
      run = []
      continue
    }
    run.push(`${point.x.toFixed(2)},${point.y.toFixed(2)}`)
  }
  if (run.length > 1) segments.push(run.join(' '))

  const hovered = hover === null ? undefined : buckets[hover.index]
  const hoveredRatio = hovered === undefined
    ? null
    : (() => {
      const prompt = promptOf(hovered)
      return prompt === 0 ? null : hovered.cacheReadTokens / prompt
    })()

  return h('div', { className: 'tdb-chart', ref },
    h('svg', {
      width,
      height,
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': t('trend.cache'),
      onMouseMove: onMove,
      onMouseLeave: () => setHover(null),
    },
    ...grid(width, scale, toY, intl, right),
    h('text', { x: width - right + 6, y: TOP + 3, className: 'tdb-axis-text' }, '100%'),
    h('text', { x: width - right + 6, y: TOP + innerHeight / 2, className: 'tdb-axis-text' }, '50%'),
    h('text', { x: width - right + 6, y: bottom, className: 'tdb-axis-text' }, '0%'),
    h('line', { x1: LEFT, y1: bottom, x2: width - right, y2: bottom, className: 'tdb-axis-line' }),
    hover === null ? null : h('rect', {
      className: 'tdb-hover-band',
      x: LEFT + band * hover.index,
      y: TOP,
      width: band,
      height: innerHeight,
      rx: Math.min(4, band / 2),
    }),
    ...buckets.map((bucket, index) => {
      const readHeight = visibleHeight(bucket.cacheReadTokens, toY, bottom)
      const writeHeight = visibleHeight(bucket.cacheWriteTokens, toY, bottom)
      return h('g', { key: bucket.bucket },
        readHeight <= 0 ? null : h('rect', {
          x: LEFT + band * index + (band - barWidth) / 2,
          y: bottom - readHeight,
          width: barWidth,
          height: readHeight,
          rx: Math.min(2.5, barWidth / 2),
          className: 'tdb-bar tdb-bar--cache-read',
        }),
        writeHeight <= 0 ? null : h('rect', {
          x: LEFT + band * index + (band - barWidth) / 2,
          y: bottom - readHeight - writeHeight,
          width: barWidth,
          height: writeHeight,
          rx: Math.min(2.5, barWidth / 2),
          className: 'tdb-bar tdb-bar--cache-write',
        }))
    }),
    ...segments.map((points, index) => h('polyline', {
      key: `hit-${index}`,
      points,
      className: 'tdb-line-hit',
    })),
    ...hitPoints.map(point => point === null ? null : h('circle', {
      key: `dot-${point.index}`,
      cx: point.x,
      cy: point.y,
      r: hover?.index === point.index ? 3.2 : 2,
      className: 'tdb-dot-hit',
    })),
    ...xLabels(buckets, band, width, bottom, labelOf),
    hover === null || hovered === undefined ? null : h(Tooltip, {
      x: tooltipX(hover.x, width),
      y: tooltipY(hover.y, height),
      title: labelOf(hovered),
      rows: [
        { label: t('legend.cacheRead'), value: formatCompact(hovered.cacheReadTokens, intl), color: 'var(--tdb-cat-cache-read)' },
        { label: t('legend.cacheWrite'), value: formatCompact(hovered.cacheWriteTokens, intl), color: 'var(--tdb-cat-cache-write)' },
        { label: t('legend.hitRate'), value: hoveredRatio === null ? '—' : formatPercent(hoveredRatio), color: 'var(--tdb-cat-hit)' },
      ],
    }),
    empty ? h('div', { className: 'tdb-chart-empty' }, t('trend.emptyCache')) : null))
}

interface TooltipProps {
  x: number
  y: number
  title: string
  rows: Array<{ label: string; value: string; color?: string | undefined }>
}

function Tooltip({ x, y, title, rows }: TooltipProps): ReactElement {
  return h('div', { className: 'tdb-tooltip', style: { left: x, top: y } },
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
  scale: Scale,
  toY: (value: number) => number,
  intl: string | undefined,
  right: number = RIGHT,
): ReactElement[] {
  const lines: ReactElement[] = []
  for (let index = 0; index <= INTERVALS; index += 1) {
    const value = scale.step * index
    const y = toY(value)
    lines.push(h('line', {
      key: `grid-${index}`,
      x1: LEFT,
      y1: y,
      x2: width - right,
      y2: y,
      className: 'tdb-grid-line',
    }))
    lines.push(h('text', {
      key: `axis-${index}`,
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

function promptOf(bucket: UsageBucket): number {
  return bucket.uncachedInputTokens + bucket.cacheReadTokens + bucket.cacheWriteTokens
}

function niceScale(raw: number): Scale {
  if (!Number.isFinite(raw) || raw <= 0) return { maximum: INTERVALS, step: 1 }
  const rough = raw / INTERVALS
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  const step = Math.max(1, factor * magnitude)
  return { maximum: step * INTERVALS, step }
}

function visibleHeight(value: number, toY: (value: number) => number, bottom: number): number {
  if (value <= 0) return 0
  return Math.max(1, bottom - toY(value))
}

function tooltipX(x: number, width: number): number {
  const edge = Math.min(115, width / 2)
  return clamp(x, edge, width - edge)
}

function tooltipY(y: number, height: number): number {
  const edge = Math.max(8, height - 120)
  return clamp(y + 12, 8, edge)
}

function topRoundedPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width / 2, height))
  const round = (value: number): string => String(Math.round(value * 100) / 100)
  if (r <= 0) {
    return `M${round(x)},${round(y)}h${round(width)}v${round(height)}h${round(-width)}Z`
  }
  return [
    `M${round(x)},${round(y + height)}`,
    `L${round(x)},${round(y + r)}`,
    `Q${round(x)},${round(y)} ${round(x + r)},${round(y)}`,
    `L${round(x + width - r)},${round(y)}`,
    `Q${round(x + width)},${round(y)} ${round(x + width)},${round(y + r)}`,
    `L${round(x + width)},${round(y + height)}`,
    'Z',
  ].join(' ')
}
