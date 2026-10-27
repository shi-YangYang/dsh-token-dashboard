/**
 * Optional cost estimation. Prices are supplied by the user and stored only in
 * the browser's localStorage; the plugin ships no price table and never infers
 * a rate. All amounts are labelled "Estimated Cost".
 */

import type { ModelUsage, TokenBuckets } from './types.js'

/** One model's user-configured rates, in `currency` per one million tokens. */
export interface ModelPrice {
  currency: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

/** Pricing keyed by the same `provider::model` key the usage rows use. */
export type PricingTable = Record<string, ModelPrice>

/** Suggested currencies; the editor accepts any short code as well. */
export const SUGGESTED_CURRENCIES = ['CNY', 'USD', 'EUR', 'JPY'] as const

/** A cost row for one model. */
export interface ModelCostRow {
  key: string
  provider: string
  model: string
  tokens: TokenBuckets
  requests: number
  priced: boolean
  currency: string | null
  amount: number | null
  missing: boolean
}

/** Aggregate estimate across models. */
export interface CostEstimate {
  rows: ModelCostRow[]
  totals: Array<{ currency: string; amount: number }>
  pricedModels: number
  unpricedModels: number
}

/** True only when every rate and the currency are present and valid. */
export function isPriceConfigured(price: ModelPrice | undefined): price is ModelPrice {
  if (price === undefined) return false
  if (typeof price.currency !== 'string' || price.currency.trim() === '') return false
  return [price.input, price.output, price.cacheRead, price.cacheWrite].every(validRate)
}

/** Estimated cost for one model, or null when no usable price exists. */
export function costOf(usage: Pick<TokenBuckets, 'uncachedInputTokens' | 'cacheReadTokens' | 'cacheWriteTokens' | 'outputTokens'>, price: ModelPrice | undefined): number | null {
  if (!isPriceConfigured(price)) return null
  const amount = (
    usage.uncachedInputTokens * price.input
    + usage.cacheReadTokens * price.cacheRead
    + usage.cacheWriteTokens * price.cacheWrite
    + usage.outputTokens * price.output
  ) / 1_000_000
  return Number.isFinite(amount) ? amount : null
}

/** Build the per-model estimate and currency totals for the current range. */
export function estimateCost(models: ModelUsage[], table: PricingTable): CostEstimate {
  const rows: ModelCostRow[] = []
  const totals = new Map<string, number>()
  let pricedModels = 0
  let unpricedModels = 0

  for (const model of models) {
    const price = table[model.key]
    const configured = isPriceConfigured(price)
    const amount = configured ? costOf(model, price) : null
    if (configured && amount !== null) {
      pricedModels += 1
      totals.set(price.currency, (totals.get(price.currency) ?? 0) + amount)
    } else {
      unpricedModels += 1
    }
    rows.push({
      key: model.key,
      provider: model.provider,
      model: model.model,
      tokens: {
        uncachedInputTokens: model.uncachedInputTokens,
        cacheReadTokens: model.cacheReadTokens,
        cacheWriteTokens: model.cacheWriteTokens,
        outputTokens: model.outputTokens,
      },
      requests: model.requests,
      priced: configured && amount !== null,
      currency: configured ? price.currency : null,
      amount,
      missing: !configured,
    })
  }

  return {
    rows,
    totals: [...totals.entries()].map(([currency, amount]) => ({ currency, amount })),
    pricedModels,
    unpricedModels,
  }
}

/** Parse a persisted pricing table defensively; unknown or invalid rows are dropped. */
export function parsePricing(raw: string | null | undefined): PricingTable {
  if (typeof raw !== 'string' || raw.trim() === '') return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  const table: PricingTable = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const price = normalizePrice(value)
    if (price !== null) table[key] = price
  }
  return table
}

/** Serialize a table for localStorage. */
export function serializePricing(table: PricingTable): string {
  return JSON.stringify(table)
}

/** Normalize one untrusted pricing value. */
export function normalizePrice(value: unknown): ModelPrice | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const currency = typeof record.currency === 'string' ? record.currency.trim().toUpperCase() : ''
  if (currency === '' || currency.length > 8) return null
  const input = numberOrNull(record.input)
  const output = numberOrNull(record.output)
  const cacheRead = numberOrNull(record.cacheRead)
  const cacheWrite = numberOrNull(record.cacheWrite)
  if (input === null || output === null || cacheRead === null || cacheWrite === null) return null
  return { currency, input, output, cacheRead, cacheWrite }
}

/** Format an amount using its currency, with more precision for tiny values. */
export function formatAmount(amount: number, currency: string): string {
  const digits = amount !== 0 && Math.abs(amount) < 0.01 ? 6 : 2
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(digits)}`
  }
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  return null
}

function validRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}
