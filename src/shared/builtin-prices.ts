/**
 * Built-in list prices, per one million tokens, in USD.
 *
 * DeepSeek rates are the official peak-hour prices published on 2026-10-30:
 * off-peak is half. Other entries mirror the public OpenRouter model list.
 * They are estimates, not a provider invoice, and the user can override any
 * rate in the dashboard.
 */

import type { ModelPrice } from './pricing.js'
import { GENERATED_PRICES, GENERATED_PRICE_UPDATED } from './builtin-prices.generated.js'

export const BUILTIN_PRICE_UPDATED = GENERATED_PRICE_UPDATED
export const BUILTIN_PRICE_SOURCE = 'DeepSeek official + OpenRouter snapshot'

export interface BuiltinPriceEntry {
  id: string
  aliases: readonly string[]
  price: ModelPrice
}

export const BUILTIN_PRICES: readonly BuiltinPriceEntry[] = [
  {
    id: 'deepseek-flash',
    aliases: [
      'deepseek-v4.1-flash',
      'deepseek-v4.1-flash-1017',
      'deepseek-v4-flash',
      'deepseek-v4.1-flash-vision-exp',
      'deepseek-chat',
    ],
    price: { currency: 'USD', input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0 },
  },
  {
    id: 'deepseek-v4-pro',
    aliases: [
      'deepseek-v4-pro-0813',
      'deepseek-v4.1-pro',
      'deepseek-v4',
      'deepseek-pro',
      'deepseek-reasoner',
    ],
    price: { currency: 'USD', input: 1.32, output: 3.96, cacheRead: 0.044, cacheWrite: 0 },
  },
]

const ALIASES: Readonly<Record<string, string>> = {
  'deepseek-v4.1-flash': 'deepseek-flash',
  'deepseek-v4.1-flash-1017': 'deepseek-flash',
  'deepseek-v4-flash': 'deepseek-flash',
  'deepseek-v4.1-flash-vision-exp': 'deepseek-flash',
  'deepseek-chat': 'deepseek-flash',
  'deepseek-v4-pro-0813': 'deepseek-v4-pro',
  'deepseek-v4.1-pro': 'deepseek-v4-pro',
  'deepseek-v4': 'deepseek-v4-pro',
  'deepseek-pro': 'deepseek-v4-pro',
  'deepseek-reasoner': 'deepseek-v4-pro',
}

/**
 * Every useful lookup form for one model id: the raw id, the id without its
 * vendor prefix, without a `:free`/`:batch` variant tag, without a trailing
 * date stamp, and the canonical alias.
 */
export function modelKeyCandidates(model: string): string[] {
  const raw = model.trim().toLowerCase()
  if (raw === '') return []
  const values = new Set<string>([raw])
  const add = (value: string): void => {
    if (value !== '') values.add(value)
  }
  add(raw.replace(/^[^/]+\//, ''))
  for (const value of [...values]) {
    const clean = value.replace(/:(free|batch)$/, '')
    add(clean)
    add(clean
      .replace(/[-_](20\d{2})[-_]?(\d{2})[-_]?(\d{2})$/, '')
      .replace(/[-_](\d{8})$/, '')
      .replace(/[-_](\d{4})$/, ''))
  }
  for (const value of [...values]) {
    const alias = ALIASES[value]
    if (alias !== undefined) add(alias)
  }
  return [...values]
}

const BUILTIN_BY_KEY = new Map<string, ModelPrice>()
// Hand-maintained DeepSeek aliases and official rates win over the generated
// OpenRouter snapshot; generated entries then fill every other model.
for (const entry of BUILTIN_PRICES) {
  for (const key of [entry.id, ...entry.aliases]) {
    for (const candidate of modelKeyCandidates(key)) {
      if (!BUILTIN_BY_KEY.has(candidate)) BUILTIN_BY_KEY.set(candidate, entry.price)
    }
  }
}
for (const entry of GENERATED_PRICES) {
  for (const candidate of modelKeyCandidates(entry.id)) {
    if (!BUILTIN_BY_KEY.has(candidate)) BUILTIN_BY_KEY.set(candidate, entry.price)
  }
}

/** Resolve a built-in list price by model id, ignoring provider/date variants. */
export function builtinPriceFor(model: string): ModelPrice | undefined {
  for (const key of modelKeyCandidates(model)) {
    const price = BUILTIN_BY_KEY.get(key)
    if (price !== undefined) return { ...price }
  }
  return undefined
}

/** Prefer standard entries over batch and free variants when both match. */
export function modelVariantRank(id: string): number {
  if (id.includes(':free')) return 2
  if (id.includes(':batch')) return 1
  return 0
}
