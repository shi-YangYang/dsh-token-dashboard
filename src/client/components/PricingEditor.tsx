/** Local-only pricing editor. Rates are per one million tokens. */

import { Fragment, createElement as h, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, ReactElement } from 'react'

import { Button, Modal } from './common.js'
import { ChevronLeftIcon, ChevronRightIcon } from '../icons.js'
import type { T } from '../lib.js'
import { SUGGESTED_CURRENCIES, samePrice, type ModelPrice, type PricingTable } from '../../shared/pricing.js'
import type { ModelUsage } from '../../shared/types.js'

const PAGE_SIZE = 6

interface DraftRow {
  currency: string
  input: string
  output: string
  cacheRead: string
  cacheWrite: string
}

export interface PricingEditorProps {
  open: boolean
  models: readonly ModelUsage[]
  pricing: PricingTable
  defaults: PricingTable
  t: T
  onClose: () => void
  onSave: (table: PricingTable) => void
}

export function PricingEditor({ open, models, pricing, defaults, t, onClose, onSave }: PricingEditorProps): ReactElement | null {
  const [draft, setDraft] = useState<Record<string, DraftRow>>({})
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [page, setPage] = useState(0)
  const signature = useMemo(() => models.map(model => model.key).join('|'), [models])

  useEffect(() => {
    if (!open) return
    const next: Record<string, DraftRow> = {}
    for (const model of models) {
      const price = pricing[model.key] ?? defaults[model.key]
      next[model.key] = price === undefined
        ? { currency: 'USD', input: '', output: '', cacheRead: '', cacheWrite: '' }
        : {
          currency: price.currency,
          input: String(price.input),
          output: String(price.output),
          cacheRead: String(price.cacheRead),
          cacheWrite: String(price.cacheWrite),
        }
    }
    setDraft(next)
    setErrors({})
    setPage(0)
    // Seed the form when the editor opens; keystrokes never reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, signature])

  if (!open) return null

  const pages = Math.max(1, Math.ceil(models.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = models.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  const update = (key: string, field: keyof DraftRow, value: string): void => {
    setDraft(current => ({
      ...current,
      [key]: {
        ...(current[key] ?? { currency: 'USD', input: '', output: '', cacheRead: '', cacheWrite: '' }),
        [field]: value,
      },
    }))
  }

  const save = (): void => {
    const next: PricingTable = {}
    const invalid: Record<string, boolean> = {}
    for (const model of models) {
      const row = draft[model.key]
      if (row === undefined) continue
      const raw = [row.input, row.output, row.cacheRead, row.cacheWrite]
      if (!raw.some(value => value.trim() !== '')) continue
      const parsed = raw.map(value => (value.trim() === '' ? 0 : Number(value)))
      const currency = row.currency.trim().toUpperCase()
      if (parsed.some(value => !Number.isFinite(value) || value < 0) || currency === '' || currency.length > 8) {
        invalid[model.key] = true
        continue
      }
      const candidate: ModelPrice = {
        currency,
        input: parsed[0] ?? 0,
        output: parsed[1] ?? 0,
        cacheRead: parsed[2] ?? 0,
        cacheWrite: parsed[3] ?? 0,
      }
      if (!samePrice(candidate, defaults[model.key])) next[model.key] = candidate
    }
    const firstInvalid = models.findIndex(model => invalid[model.key] === true)
    if (firstInvalid >= 0) {
      setErrors(invalid)
      setPage(Math.floor(firstInvalid / PAGE_SIZE))
      return
    }
    onSave(next)
    onClose()
  }

  const clear = (): void => {
    onSave({})
    onClose()
  }

  const footer = h('div', { style: { display: 'contents' } },
    h(Button, { variant: 'ghost', onClick: clear }, t('cost.clear')),
    h('div', { style: { display: 'flex', gap: '8px' } },
      h(Button, { onClick: onClose }, t('cost.cancel')),
      h(Button, { variant: 'primary', onClick: save }, t('cost.save'))))

  return h(Modal, {
    open: true,
    title: t('cost.manage'),
    subtitle: t('cost.perMillion'),
    onClose,
    closeLabel: t('common.close'),
    footer,
  },
  h('datalist', { key: 'currencies', id: 'tdb-pricing-currencies' },
    SUGGESTED_CURRENCIES.map(currency => h('option', { key: currency, value: currency }))),
  models.length === 0
    ? h('div', { className: 'tdb-empty' }, t('models.empty'))
    : h(Fragment, {},
      h('div', { key: 'hint', className: 'tdb-pricing-note' }, t('cost.pricingHint')),
      h('div', { key: 'grid', className: 'tdb-pricing-wrap' },
        h('div', { className: 'tdb-pricing-grid' },
        h('div', { className: 'tdb-pricing-head' }, t('models.model')),
        h('div', { className: 'tdb-pricing-head' }, t('cost.currency')),
        h('div', { className: 'tdb-pricing-head' }, t('cost.input')),
        h('div', { className: 'tdb-pricing-head' }, t('cost.output')),
        h('div', { className: 'tdb-pricing-head tdb-pricing-head--extra' }, t('cost.cacheRead')),
        h('div', { className: 'tdb-pricing-head tdb-pricing-head--extra' }, t('cost.cacheWrite')),
        visible.map(model => {
          const row = draft[model.key] ?? { currency: 'USD', input: '', output: '', cacheRead: '', cacheWrite: '' }
          const invalid = errors[model.key] === true
          return [
            h('div', { key: `${model.key}:name`, className: 'tdb-pricing-model' },
              h('div', { className: `tdb-model-name${model.model === '' ? ' tdb-model-unknown' : ''}` },
                model.model === '' ? t('models.unknown') : model.model),
              h('div', { className: 'tdb-model-provider' }, model.provider === '' ? '—' : model.provider)),
            h('input', {
              key: `${model.key}:currency`,
              className: 'tdb-input tdb-pricing-currency',
              value: row.currency,
              list: 'tdb-pricing-currencies',
              maxLength: 8,
              'aria-label': `${t('cost.currency')} ${model.model}`,
              onChange: (event: ChangeEvent<HTMLInputElement>) => update(model.key, 'currency', event.target.value),
            }),
            rateInput(model.key, 'input', row.input, t('cost.input'), invalid, value => update(model.key, 'input', value)),
            rateInput(model.key, 'output', row.output, t('cost.output'), invalid, value => update(model.key, 'output', value)),
            rateInput(model.key, 'cacheRead', row.cacheRead, t('cost.cacheRead'), invalid, value => update(model.key, 'cacheRead', value), true),
            rateInput(model.key, 'cacheWrite', row.cacheWrite, t('cost.cacheWrite'), invalid, value => update(model.key, 'cacheWrite', value), true),
            invalid
              ? h('div', { key: `${model.key}:error`, className: 'tdb-error-text', style: { gridColumn: '1 / -1' } }, t('cost.invalid'))
              : null,
          ]
        }))),
      pages > 1
        ? h('div', { key: 'pager', className: 'tdb-pager' },
          h('span', {}, t('sessions.page', { page: current + 1, pages })),
          h('div', { className: 'tdb-pager-actions' },
            h(Button, {
              variant: 'ghost',
              iconOnly: true,
              disabled: current <= 0,
              'aria-label': t('sessions.previous'),
              onClick: () => setPage(Math.max(0, current - 1)),
            }, h(ChevronLeftIcon, { size: 15 })),
            h(Button, {
              variant: 'ghost',
              iconOnly: true,
              disabled: current >= pages - 1,
              'aria-label': t('sessions.next'),
              onClick: () => setPage(Math.min(pages - 1, current + 1)),
            }, h(ChevronRightIcon, { size: 15 }))))
        : null))
}

function rateInput(
  key: string,
  field: string,
  value: string,
  label: string,
  invalid: boolean,
  onChange: (value: string) => void,
  extra = false,
): ReactElement {
  return h('input', {
    key: `${key}:${field}`,
    className: `tdb-input tdb-pricing-input${invalid ? ' tdb-pricing-row-error' : ''}${extra ? ' tdb-pricing-cell--extra' : ''}`,
    type: 'text',
    inputMode: 'decimal',
    value,
    placeholder: '0',
    'aria-label': label,
    onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
  })
}
