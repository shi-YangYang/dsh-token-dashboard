/** Session detail content, rendered inside the shared drawer shell. */

import { createElement as h } from 'react'
import type { ReactElement } from 'react'

import { Button, Tag } from './common.js'
import { ArrowRightIcon } from '../icons.js'
import { Drawer } from './ui/Drawer.js'
import { Field, Stat } from './ui/Stat.js'
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
  if (session === null) return null

  const title = session.title ?? t('sessions.untitled')
  const badges = [
    session.live ? h(Tag, { key: 'live', tone: 'live' }, t('sessions.live')) : null,
    session.origin === 'subagent' ? h(Tag, { key: 'sub', tone: 'sub' }, t('sessions.subagent')) : null,
    session.seeded ? h(Tag, { key: 'fork' }, t('sessions.fork')) : null,
    session.stale ? h(Tag, { key: 'stale', tone: 'stale' }, t('sessions.stale')) : null,
  ]

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

  const footer = onOpen === undefined
    ? h(Button, { variant: 'primary', onClick: onClose }, t('detail.close'))
    : h(Button, { variant: 'primary', onClick: () => onOpen(session.id) },
      h(ArrowRightIcon, { size: 14 }), t('detail.open'))

  return h(Drawer, {
    open: true,
    title,
    badges: badges.some(Boolean) ? badges : undefined,
    closeLabel: t('detail.close'),
    onClose,
    footer,
  },
  h('div', { key: 'stats', className: 'tdb-detail-stats' },
    h(Stat, { label: t('detail.total'), value: formatNumber(totalTokens(session.totals), intl), total: true }),
    h(Stat, { label: t('detail.input'), value: formatNumber(session.totals.uncachedInputTokens, intl) }),
    h(Stat, { label: t('detail.output'), value: formatNumber(session.totals.outputTokens, intl) }),
    h(Stat, { label: t('detail.cache'), value: formatNumber(cacheTokens(session.totals), intl) }),
    h(Stat, { label: t('detail.requests'), value: formatNumber(session.requests, intl) })),
  h('div', { key: 'fields', className: 'tdb-fields' },
    h(Field, { label: t('detail.created'), value: formatDateTime(session.createdAt, intl) }),
    h(Field, { label: t('detail.last'), value: formatDateTime(session.lastActivity, intl) }),
    h(Field, { label: t('sessions.project'), value: session.project === '' ? '—' : session.project }),
    h(Field, { label: t('detail.hitRate'), value: formatPercent(session.cacheHitRate) })),
  h('div', { key: 'models' },
    h('h3', { className: 'tdb-section-title', style: { marginBottom: '10px' } }, t('detail.models')),
    models))
}
