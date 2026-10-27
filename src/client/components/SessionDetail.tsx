/** Session detail drawer: short, user-facing numbers and per-model usage. */

import { createElement as h } from 'react'
import type { ReactElement } from 'react'

import { Button, Tag } from './common.js'
import { ArrowRightIcon, CloseIcon } from '../icons.js'
import { useModal } from '../hooks.js'
import type { T } from '../lib.js'
import { formatCompact, formatDateTime, formatNumber, formatPercent } from '../../shared/format.js'
import { cacheTokens, totalTokens } from '../../shared/model.js'
import type { SessionSummary } from '../../shared/types.js'

export interface SessionDetailProps {
  session: SessionSummary | null
  t: T
  intl: string | undefined
  onClose: () => void
  onOpen?: ((id: string) => void) | undefined
}

export function SessionDetail({ session, t, intl, onClose, onOpen }: SessionDetailProps): ReactElement | null {
  const ref = useModal(session !== null, onClose)
  if (session === null) return null

  const title = session.title ?? t('sessions.untitled')
  const total = totalTokens(session.totals)

  const models = session.models.length === 0
    ? h('div', { className: 'tdb-empty', style: { padding: '20px 0' } }, t('detail.none'))
    : h('div', { className: 'tdb-detail-models' },
      session.models.map(model => h('div', { key: model.key, className: 'tdb-detail-model' },
        h('div', { className: 'tdb-detail-model-head' },
          h('div', { style: { minWidth: 0 } },
            h('div', { className: `tdb-model-name${model.model === '' ? ' tdb-model-unknown' : ''}` },
              model.model === '' ? t('models.unknown') : model.model),
            h('div', { className: 'tdb-model-provider' }, model.provider === '' ? '—' : model.provider)),
          h('div', { className: 'tdb-detail-model-total' }, formatNumber(totalTokens(model), intl))),
        h('div', { className: 'tdb-detail-model-meta' },
          `${t('detail.input')} ${formatCompact(model.uncachedInputTokens, intl)} · `
          + `${t('detail.output')} ${formatCompact(model.outputTokens, intl)} · `
          + `${t('detail.cache')} ${formatCompact(cacheTokens(model), intl)} · `
          + `${formatNumber(model.requests, intl)} ${t('detail.requests').toLowerCase()}`))))

  return h('div', {
    className: 'tdb-drawer-backdrop',
    onMouseDown: (event: { target: unknown, currentTarget: unknown }) => {
      if (event.target === event.currentTarget) onClose()
    },
  },
  h('aside', {
    className: 'tdb-drawer',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title,
    ref,
  },
  h('div', { className: 'tdb-drawer-head' },
    h('div', { style: { minWidth: 0 } },
      h('h2', { className: 'tdb-drawer-title' }, title),
      h('div', { className: 'tdb-session-badges' },
        session.live ? h(Tag, { tone: 'live' }, t('sessions.live')) : null,
        session.origin === 'subagent' ? h(Tag, { tone: 'sub' }, t('sessions.subagent')) : null,
        session.seeded ? h(Tag, {}, t('sessions.fork')) : null,
        session.stale ? h(Tag, { tone: 'stale' }, t('sessions.stale')) : null)),
    h(Button, {
      variant: 'ghost',
      iconOnly: true,
      'data-autofocus': true,
      'aria-label': t('detail.close'),
      onClick: onClose,
    }, h(CloseIcon, { size: 16 }))),
  h('div', { className: 'tdb-drawer-body' },
    h('div', { className: 'tdb-detail-stats' },
      h(Stat, { label: t('detail.total'), value: formatNumber(total, intl), total: true }),
      h(Stat, { label: t('detail.input'), value: formatNumber(session.totals.uncachedInputTokens, intl) }),
      h(Stat, { label: t('detail.output'), value: formatNumber(session.totals.outputTokens, intl) }),
      h(Stat, { label: t('detail.cache'), value: formatNumber(cacheTokens(session.totals), intl) }),
      h(Stat, { label: t('detail.requests'), value: formatNumber(session.requests, intl) })),
    h('div', { className: 'tdb-fields' },
      h(Field, { label: t('detail.created'), value: formatDateTime(session.createdAt, intl) }),
      h(Field, { label: t('detail.last'), value: formatDateTime(session.lastActivity, intl) }),
      h(Field, { label: t('sessions.project'), value: session.project === '' ? '—' : session.project }),
      h(Field, { label: t('detail.hitRate'), value: formatPercent(session.cacheHitRate) })),
    h('div', {},
      h('h3', { className: 'tdb-section-title', style: { marginBottom: '10px' } }, t('detail.models')),
      models)),
  h('div', { className: 'tdb-drawer-foot' },
    onOpen === undefined
      ? h(Button, { variant: 'primary', onClick: onClose }, t('detail.close'))
      : h(Button, { variant: 'primary', onClick: () => onOpen(session.id) },
        h(ArrowRightIcon, { size: 14 }), t('detail.open')))))
}

function Stat({ label, value, total = false }: { label: string; value: string; total?: boolean }): ReactElement {
  return h('div', { className: `tdb-detail-stat${total ? ' tdb-detail-stat--total' : ''}` },
    h('div', { className: 'tdb-detail-label' }, label),
    h('div', { className: 'tdb-detail-value' }, value))
}

function Field({ label, value }: { label: string; value: string }): ReactElement {
  return h('div', { className: 'tdb-field' },
    h('div', { className: 'tdb-field-label' }, label),
    h('div', { className: 'tdb-field-value' }, value))
}
