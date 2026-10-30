/** Client runtime glue: locale, slot context, HTTP fetch, and small helpers. */

import type { PricingTable } from '../shared/pricing.js'
import { normalizePrice } from '../shared/pricing.js'
import type { StatsPayload } from '../shared/types.js'

/** Locale namespace registered by this plugin. */
export const NS = 'dsh-token-dashboard'

/** `main` key and `sidebar.panellist` id; they must match. */
export const PANEL_ID = 'dsh-token-dashboard'

export const API_VERSION = 1

export const ENDPOINT = 'dsh-token-dashboard/stats'

export const PRICING_KEY = 'dsh-token-dashboard:pricing:v1'

export const ONLINE_PRICING_KEY = 'dsh-token-dashboard:pricing:online:v1'

export const POLL_INTERVAL_MS = 4_000

export type RawTranslate = (key: string) => string

export type T = (key: string, params?: Record<string, string | number>) => string

/** Wrap a bound locale translate function with `{name}` interpolation. */
export function makeT(raw: RawTranslate): T {
  return (key, params) => {
    let text: string
    try {
      text = raw(key)
    } catch {
      text = key
    }
    if (typeof text !== 'string' || text === '') text = key
    if (params === undefined) return text
    return text.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = params[name]
      return value === undefined ? match : String(value)
    })
  }
}

export interface LocaleSnapshot {
  readonly id?: string
  readonly locale?: string
}

export interface LocaleLike {
  register(ns: string, dicts: { zh: Record<string, string>; en: Record<string, string> }): unknown
  bind(ns: string): RawTranslate
  subscribe(listener: () => void): () => void
  getSnapshot(): LocaleSnapshot
  getLocale?(): LocaleSnapshot
}

export interface SlotsLike {
  inject(name: string, callback: () => unknown): unknown
  register(options: Record<string, unknown>, component: (props: Record<string, unknown>) => unknown): unknown
}

export interface ClientContextLike {
  effect(callback: () => void | (() => void), label?: string): unknown
  slots: SlotsLike
  locale: LocaleLike
  layout: LayoutLike
  inject?(services: readonly string[], callback: (ctx: ClientContextLike & { uiWorkspace?: UiWorkspaceLike }) => void): unknown
  get?(name: string): unknown
}

export interface UiWorkspaceLike {
  openSession?(target: string): void
}

export interface LayoutLike {
  selectPanel(panelId: string | null): void
}

/** Pick an `Intl` locale from the host's active locale id. */
export function intlLocaleOf(locale: LocaleSnapshot | undefined): string | undefined {
  const id = locale?.id ?? locale?.locale
  if (typeof id !== 'string' || id === '') return undefined
  if (id.startsWith('zh')) return 'zh-CN'
  if (id.startsWith('en')) return 'en-US'
  return id
}

/** Same-origin URL for one dashboard API path, honoring a mounted base path. */
export function endpoint(subpath: string, params?: Record<string, string>): string {
  const base = typeof document === 'undefined' ? 'http://localhost/' : document.baseURI
  const url = new URL(`dsh-token-dashboard/${subpath.replace(/^\/+/, '')}`, base)
  if (params !== undefined) {
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  }
  return `${url.pathname}${url.search}`
}

export interface FetchedStats {
  payload: StatsPayload
  etag: string | null
}

/**
 * Fetch the dashboard payload.
 * @param force bypasses the ETag and asks the Host to reconcile revisions.
 * @param etag previous response ETag, when polling.
 * @returns null for 304 Not Modified.
 */
export async function fetchStats(
  force: boolean,
  etag: string | null,
  signal: AbortSignal,
): Promise<FetchedStats | null> {
  const params: Record<string, string> = force ? { refresh: '1' } : {}
  const headers: Record<string, string> = { accept: 'application/json' }
  if (!force && etag !== null) headers['if-none-match'] = etag
  const response = await fetch(endpoint('stats', params), { headers, signal, cache: 'no-store' })
  if (response.status === 304) return null
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const payload: unknown = await response.json()
  if (!isStatsPayload(payload)) throw new Error('unexpected response')
  return { payload, etag: response.headers.get('etag') }
}

/** Narrow an unknown response body to the wire contract this client understands. */
export function isStatsPayload(value: unknown): value is StatsPayload {
  if (value === null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return record.apiVersion === API_VERSION
    && typeof record.revision === 'number'
    && typeof record.generatedAt === 'number'
    && record.totals !== null && typeof record.totals === 'object'
    && Array.isArray(record.days)
    && Array.isArray(record.hours)
    && Array.isArray(record.models)
    && Array.isArray(record.sessionRows)
}

export interface OnlinePrices {
  prices: PricingTable
  source: string
  fetchedAt: number
}

/** Fetch current OpenRouter list prices through the same-origin Host proxy. */
export async function fetchOnlinePrices(models: readonly string[]): Promise<OnlinePrices> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(endpoint('prices', {
      refresh: '1',
      models: models.join(','),
    }), {
      headers: { accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload: unknown = await response.json()
    if (payload === null || typeof payload !== 'object') throw new Error('unexpected response')
    const record = payload as Record<string, unknown>
    const source = typeof record.source === 'string' ? record.source : 'OpenRouter'
    const rawAt = record.fetchedAt
    const parsedAt = typeof rawAt === 'number'
      ? rawAt
      : typeof rawAt === 'string' ? Date.parse(rawAt) : Number.NaN
    const fetchedAt = Number.isFinite(parsedAt) ? parsedAt : Date.now()
    const prices: PricingTable = {}
    if (record.prices !== null && typeof record.prices === 'object' && !Array.isArray(record.prices)) {
      for (const [name, value] of Object.entries(record.prices as Record<string, unknown>)) {
        const price = normalizePrice(value)
        if (price !== null) prices[name.trim().toLowerCase()] = price
      }
    }
    return { prices, source, fetchedAt }
  } finally {
    clearTimeout(timer)
  }
}

/** Trigger a browser download for generated text; no DOM is left behind. */
export function downloadFile(filename: string, content: string, mime: string): void {
  if (typeof document === 'undefined') return
  const body = mime === 'text/csv' ? `\uFEFF${content}` : content
  const blob = new Blob([body], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 2_000)
}

/** Copy text to the clipboard, returning false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the selection-based path.
  }
  return false
}
