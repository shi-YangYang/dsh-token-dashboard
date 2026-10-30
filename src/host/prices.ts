/**
 * Optional online price lookup. The Host fetches the public OpenRouter model
 * list only when the user presses "Refresh online"; no request is made at
 * startup and no session data leaves the dashboard.
 */

import { modelKeyCandidates, modelVariantRank } from '../shared/builtin-prices.js'
import type { ModelPrice } from '../shared/pricing.js'

export interface PricePayload {
  source: string
  fetchedAt: string
  prices: Record<string, ModelPrice>
}

export interface PriceLookup {
  lookup(models: readonly string[], force: boolean): Promise<PricePayload>
}

interface FetchResponseLike {
  ok: boolean
  status: number
  json(): Promise<unknown>
}

export type PriceFetch = (
  url: string,
  init: { signal: AbortSignal; headers: Record<string, string> },
) => Promise<FetchResponseLike>

export interface PriceServiceOptions {
  fetch?: PriceFetch
  now?: () => number
  ttlMs?: number
  url?: string
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/models'
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1_000

export interface OpenRouterEntry {
  id: string
  keys: readonly string[]
  price: ModelPrice
  rank: number
}

/** Parse the subset of the OpenRouter response the dashboard needs. */
export function parseOpenRouterEntries(payload: unknown): OpenRouterEntry[] {
  if (payload === null || typeof payload !== 'object') return []
  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) return []
  const entries: OpenRouterEntry[] = []
  for (const raw of data) {
    if (raw === null || typeof raw !== 'object') continue
    const record = raw as Record<string, unknown>
    if (typeof record.id !== 'string' || record.id.trim() === '') continue
    const pricing = record.pricing
    if (pricing === null || typeof pricing !== 'object' || Array.isArray(pricing)) continue
    const priceRecord = pricing as Record<string, unknown>
    const input = perMillion(priceRecord.prompt)
    const output = perMillion(priceRecord.completion)
    if (input === null || output === null) continue
    entries.push({
      id: record.id,
      keys: modelKeyCandidates(record.id),
      price: {
        currency: 'USD',
        input,
        output,
        cacheRead: perMillion(priceRecord.input_cache_read) ?? 0,
        cacheWrite: perMillion(priceRecord.input_cache_write) ?? 0,
      },
      rank: modelVariantRank(record.id),
    })
  }
  return entries
}

/** Resolve one requested model against the parsed list, preferring standard variants. */
export function resolveOpenRouterPrice(entries: readonly OpenRouterEntry[], requested: string): ModelPrice | undefined {
  const keys = new Set(modelKeyCandidates(requested))
  if (keys.size === 0) return undefined
  let best: OpenRouterEntry | undefined
  for (const entry of entries) {
    if (!entry.keys.some(key => keys.has(key))) continue
    if (best === undefined || entry.rank < best.rank) best = entry
  }
  return best === undefined ? undefined : { ...best.price }
}

/** Create a cached lookup service for the Host route. */
export function createPriceService(options: PriceServiceOptions = {}): PriceLookup {
  const now = options.now ?? Date.now
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  const url = options.url ?? OPENROUTER_URL
  const fetchImpl = options.fetch
    ?? ((input, init) => (globalThis.fetch as unknown as PriceFetch)(input, init))
  let cache: { at: number; entries: OpenRouterEntry[] } | null = null

  const load = async (force: boolean): Promise<OpenRouterEntry[]> => {
    if (!force && cache !== null && now() - cache.at < ttlMs) return cache.entries
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8_000)
    try {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'user-agent': 'dsh-token-dashboard/0.1',
        },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const entries = parseOpenRouterEntries(await response.json())
      cache = { at: now(), entries }
      return entries
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    async lookup(models, force) {
      if (models.length === 0) {
        return { source: 'OpenRouter', fetchedAt: new Date(now()).toISOString(), prices: {} }
      }
      const entries = await load(force)
      const prices: Record<string, ModelPrice> = {}
      for (const model of models) {
        const price = resolveOpenRouterPrice(entries, model)
        if (price !== undefined) prices[model] = price
      }
      return {
        source: 'OpenRouter',
        fetchedAt: new Date(now()).toISOString(),
        prices,
      }
    },
  }
}

function perMillion(value: unknown): number | null {
  const rate = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  if (!Number.isFinite(rate) || rate < 0) return null
  return Math.round(rate * 1_000_000 * 1_000_000) / 1_000_000
}
