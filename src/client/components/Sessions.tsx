/** Session table: search, two filters, sortable time/total columns. */

import { createElement as h, useMemo, useState } from 'react'
import type { ChangeEvent, ReactElement } from 'react'

import { Button, EmptyState, Tag } from './common.js'
import { Select } from './ui/Select.js'
import { ChevronLeftIcon, ChevronRightIcon, DatabaseIcon, SearchIcon } from '../icons.js'
import { Section } from './ui/Section.js'
import { DataTable } from './ui/DataTable.js'
import type { DataColumn } from './ui/DataTable.js'
import type { T } from '../lib.js'
import { formatDateTime, formatNumber, formatRelative } from '../../shared/format.js'
import { totalTokens } from '../../shared/model.js'
import type { SessionSummary } from '../../shared/types.js'

const PAGE_SIZE = 10

type SortKey = 'last' | 'total'
type SortDir = 'asc' | 'desc'

export interface SessionsProps {
  rows: readonly SessionSummary[]
  t: T
  intl: string | undefined
  now: number
  onSelect: (session: SessionSummary) => void
}

export function SessionTable({ rows, t, intl, now, onSelect }: SessionsProps): ReactElement {
  const [query, setQuery] = useState('')
  const [project, setProject] = useState('')
  const [model, setModel] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('last')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  const projects = useMemo(() => {
    const values = new Set<string>()
    for (const row of rows) if (row.project !== '') values.add(row.project)
    return [...values].sort((left, right) => left.localeCompare(right))
  }, [rows])

  const modelOptions = useMemo(() => {
    const values = new Map<string, string>()
    for (const row of rows) {
      for (const item of row.models) {
        if (!values.has(item.key)) values.set(item.key, item.model === '' ? t('models.unknown') : item.model)
      }
    }
    return [...values.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label))
  }, [rows, t])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const result = rows.filter(row => {
      if (project !== '' && row.project !== project) return false
      if (model !== '' && !row.modelKeys.includes(model)) return false
      if (needle === '') return true
      if ((row.title ?? '').toLowerCase().includes(needle)) return true
      if (row.project.toLowerCase().includes(needle)) return true
      if (row.id.toLowerCase().includes(needle)) return true
      return row.models.some(item =>
        item.model.toLowerCase().includes(needle) || item.provider.toLowerCase().includes(needle))
    })

    return result.sort((left, right) => {
      const delta = sortKey === 'total'
        ? totalTokens(left.totals) - totalTokens(right.totals)
        : left.lastActivity - right.lastActivity
      return sortDir === 'asc' ? delta : -delta
    })
  }, [rows, query, project, model, sortKey, sortDir])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  const resetPage = (): void => setPage(0)

  const toggleSort = (key: SortKey): void => {
    if (sortKey === key) setSortDir(direction => (direction === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
    resetPage()
  }

  const columns: Array<DataColumn<SessionSummary>> = [
    {
      key: 'session',
      header: t('sessions.session'),
      headerClassName: 'tdb-session-cell',
      render: row => h('div', {},
        h('div', { className: 'tdb-session-title' }, row.title ?? t('sessions.untitled')),
        h('div', { className: 'tdb-session-badges' },
          row.project === '' ? null : h('span', { className: 'tdb-session-sub' }, row.project),
          row.live ? h(Tag, { tone: 'live' }, t('sessions.live')) : null,
          row.origin === 'subagent' ? h(Tag, { tone: 'sub' }, t('sessions.subagent')) : null,
          row.seeded ? h(Tag, {}, t('sessions.fork')) : null,
          row.stale ? h(Tag, { tone: 'stale' }, t('sessions.stale')) : null)),
    },
    {
      key: 'models',
      header: t('sessions.models'),
      headerClassName: 'tdb-hide-sm',
      cellClassName: 'tdb-hide-sm',
      render: row => {
        const first = row.models[0]
        return first === undefined
          ? '—'
          : h('span', { className: 'tdb-session-model' },
            first.model === '' ? t('models.unknown') : first.model,
            row.models.length > 1
              ? h('span', { className: 'tdb-model-provider' },
                ` ${t('sessions.modelsMore', { count: row.models.length - 1 })}`)
              : null)
      },
    },
    {
      key: 'last',
      header: h(SortHeader, {
        label: t('sessions.last'),
        title: t('sessions.sortLast'),
        active: sortKey === 'last',
        direction: sortDir,
        onClick: () => toggleSort('last'),
      }),
      headerProps: { 'aria-sort': activeSort(sortKey === 'last', sortDir) },
      cellClassName: 'tdb-nowrap',
      render: row => h('span', { title: formatDateTime(row.lastActivity, intl) },
        formatRelative(row.lastActivity, now, intl)),
    },
    {
      key: 'total',
      header: h(SortHeader, {
        label: t('sessions.total'),
        title: t('sessions.sortTotal'),
        active: sortKey === 'total',
        direction: sortDir,
        onClick: () => toggleSort('total'),
      }),
      headerClassName: 'tdb-num',
      headerProps: { 'aria-sort': activeSort(sortKey === 'total', sortDir) },
      cellClassName: 'tdb-num',
      render: row => h('span', { style: { fontWeight: 600 } }, formatNumber(totalTokens(row.totals), intl)),
    },
  ]

  const body = rows.length === 0
    ? h(EmptyState, { icon: h(DatabaseIcon, { size: 20 }), title: t('sessions.empty') })
    : filtered.length === 0
      ? h(EmptyState, { icon: h(SearchIcon, { size: 20 }), title: t('sessions.emptyFiltered') })
      : h('div', { className: 'tdb-table-panel' },
        h(DataTable<SessionSummary>, {
          rows: visible,
          columns,
          rowKey: row => row.id,
          ariaLabel: t('sessions.title'),
          rowClassName: 'tdb-row',
          onRowActivate: onSelect,
        }),
        h('div', { className: 'tdb-pager' },
          h('span', {}, t('sessions.count', { count: formatNumber(filtered.length, intl) })),
          h('div', { className: 'tdb-pager-actions' },
            h(Button, {
              variant: 'ghost',
              iconOnly: true,
              disabled: current <= 0,
              'aria-label': t('sessions.previous'),
              onClick: () => setPage(Math.max(0, current - 1)),
            }, h(ChevronLeftIcon, { size: 15 })),
            h('span', {}, t('sessions.page', { page: current + 1, pages })),
            h(Button, {
              variant: 'ghost',
              iconOnly: true,
              disabled: current >= pages - 1,
              'aria-label': t('sessions.next'),
              onClick: () => setPage(Math.min(pages - 1, current + 1)),
            }, h(ChevronRightIcon, { size: 15 })))))

  return h(Section, { ariaLabel: t('sessions.title') },
    rows.length === 0
      ? body
      : h('div', {},
        h('div', { className: 'tdb-filters' },
          h('div', { className: 'tdb-search' },
            h(SearchIcon, { size: 14 }),
            h('input', {
              className: 'tdb-input',
              type: 'search',
              value: query,
              placeholder: t('sessions.search'),
              'aria-label': t('sessions.search'),
              onChange: (event: ChangeEvent<HTMLInputElement>) => {
                setQuery(event.target.value)
                resetPage()
              },
            })),
          h(Select, {
            value: project,
            ariaLabel: t('sessions.project'),
            options: [{ value: '', label: t('sessions.projectAll') }, ...projects.map(value => ({ value, label: value }))],
            onChange: (value: string) => {
              setProject(value)
              resetPage()
            },
          }),
          h(Select, {
            value: model,
            ariaLabel: t('models.model'),
            options: [{ value: '', label: t('sessions.modelAll') }, ...modelOptions],
            onChange: (value: string) => {
              setModel(value)
              resetPage()
            },
          })),
        body))
}

interface SortHeaderProps {
  label: string
  title: string
  active: boolean
  direction: SortDir
  onClick: () => void
}

function SortHeader({ label, title, active, direction, onClick }: SortHeaderProps): ReactElement {
  return h('button', {
    type: 'button',
    className: 'tdb-sort-btn',
    title,
    onClick,
  },
  label,
  active
    ? h('span', { className: 'tdb-sort-arrow', 'aria-hidden': 'true' }, direction === 'asc' ? '▲' : '▼')
    : null)
}

function activeSort(active: boolean, direction: SortDir): 'ascending' | 'descending' | 'none' {
  if (!active) return 'none'
  return direction === 'asc' ? 'ascending' : 'descending'
}
