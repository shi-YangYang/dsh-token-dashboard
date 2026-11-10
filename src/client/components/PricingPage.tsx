/** Dedicated, local-only price editor page. Rates are per one million tokens. */

import { Fragment, createElement as h, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, ReactElement } from 'react'

import { Button } from './common.js'
import { Select } from './ui/Select.js'
import { Pager } from './ui/Pager.js'
import { Section } from './ui/Section.js'
import type { T } from '../lib.js'
import { SUGGESTED_CURRENCIES, samePrice, type ModelPrice, type PricingTable } from '../../shared/pricing.js'
import type { ModelUsage } from '../../shared/types.js'
import { TABLE_PAGE_SIZE } from '../table.js'
import { modelKeyCandidates } from '../../shared/builtin-prices.js'

interface DraftRow {
  currency: string
  input: string
  output: string
  cacheRead: string
  cacheWrite: string
}

export interface PricingPageProps {
  models: readonly ModelUsage[]
  pricing: PricingTable
  defaults: PricingTable
  t: T
  onSave: (table: PricingTable) => void
}

function seed(models: readonly ModelUsage[], pricing: PricingTable, defaults: PricingTable): Record<string, DraftRow> {
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
  return next
}

export function PricingPage({ models, pricing, defaults, t, onSave }: PricingPageProps): ReactElement {
  const [draft, setDraft] = useState<Record<string, DraftRow>>(() => seed(models, pricing, defaults))
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [page, setPage] = useState(0)
  const signature = useMemo(() => models.map(model => model.key).join('|'), [models])

  useEffect(() => {
    setDraft(seed(models, pricing, defaults))
    setErrors({})
    setPage(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const pages = Math.max(1, Math.ceil(models.length / TABLE_PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = models.slice(current * TABLE_PAGE_SIZE, current * TABLE_PAGE_SIZE + TABLE_PAGE_SIZE)

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
    const next: PricingTable = { ...pricing }
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
      const keys = new Set([model.key, ...modelKeyCandidates(model.model)])
      if (!samePrice(candidate, defaults[model.key])) {
        for (const key of keys) next[key] = candidate
      } else {
        for (const key of keys) delete next[key]
      }
    }
    const firstInvalid = models.findIndex(model => invalid[model.key] === true)
    if (firstInvalid >= 0) {
      setErrors(invalid)
      setPage(Math.floor(firstInvalid / TABLE_PAGE_SIZE))
      return
    }
    onSave(next)
    setErrors({})
  }

  const clear = (): void => {
    onSave({})
    setDraft(seed(models, {}, defaults))
    setErrors({})
  }

  const body = models.length === 0
    ? h('div', { className: 'tdb-empty' }, t('models.empty'))
    : h(Fragment, {},
      h('div', { className: 'tdb-pricing-wrap' },
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
              h(Select, {
                key: `${model.key}:currency`,
                value: row.currency,
                options: currencyOptions(row.currency),
                className: 'tdb-pricing-currency',
                ariaLabel: `${t('cost.currency')} ${model.model}`,
                onChange: (value: string) => update(model.key, 'currency', value),
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
        ? h(Pager, {
          page: current + 1,
          pages,
          onChange: next => setPage(next - 1),
          label: t('sessions.page', { page: current + 1, pages }),
          ariaLabel: t('tabs.pricing'),
        })
        : null)

  return h(Section, { ariaLabel: t('tabs.pricing') },
    h('div', { className: 'tdb-pricing-page' },
      h('div', { className: 'tdb-pricing-note' }, t('cost.pricingHint')),
      body,
      h('div', { className: 'tdb-pricing-actions' },
        h(Button, { variant: 'ghost', onClick: clear }, t('cost.clear')),
        h(Button, { variant: 'primary', onClick: save }, t('cost.save')))))
}

function currencyOptions(current: string): Array<{ value: string; label: string }> {
  const values = new Set<string>(SUGGESTED_CURRENCIES)
  const normalized = current.trim().toUpperCase()
  if (normalized !== '') values.add(normalized)
  return [...values].map(value => ({ value, label: value }))
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
