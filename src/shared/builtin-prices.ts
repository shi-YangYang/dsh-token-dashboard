/**
 * Built-in list prices, per one million tokens, in USD.
 *
 * DeepSeek rates are the official peak-hour prices published on 2026-10-30:
 * off-peak is half. Other entries mirror the public OpenRouter model list.
 * They are estimates, not a provider invoice, and the user can override any
 * rate in the dashboard.
 */

import type { ModelPrice } from './pricing.js'

export const BUILTIN_PRICE_UPDATED = '2026-10-30'
export const BUILTIN_PRICE_SOURCE = 'DeepSeek official + OpenRouter'

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
  {
    id: 'gpt-6.1-terra',
    aliases: ['gpt-6.1-terra-pro'],
    price: { currency: 'USD', input: 1, output: 5, cacheRead: 0.05, cacheWrite: 1.25 },
  },
  {
    id: 'gpt-6-luna',
    aliases: [],
    price: { currency: 'USD', input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  },
  {
    id: 'gpt-6-sol',
    aliases: [],
    price: { currency: 'USD', input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  },
  {
    id: 'claude-opus-5.5',
    aliases: [],
    price: { currency: 'USD', input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  },
  {
    id: 'kimi-k3.1-pro',
    aliases: [],
    price: { currency: 'USD', input: 2, output: 10, cacheRead: 0.2, cacheWrite: 0 },
  },
  {
    id: 'minimax-m3.1-flash',
    aliases: [],
    price: { currency: 'USD', input: 0.15, output: 0.6, cacheRead: 0.015, cacheWrite: 0 },
  },
  {
    id: 'mimo-v2.6-flash',
    aliases: [],
    price: { currency: 'USD', input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0 },
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
for (const entry of BUILTIN_PRICES) {
  for (const key of [entry.id, ...entry.aliases]) {
    for (const candidate of modelKeyCandidates(key)) {
      if (!BUILTIN_BY_KEY.has(candidate)) BUILTIN_BY_KEY.set(candidate, entry.price)
    }
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
