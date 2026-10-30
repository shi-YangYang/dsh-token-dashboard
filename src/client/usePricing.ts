/** Browser-local pricing state, shared by the cost row and editor. */

import { useCallback, useState } from 'react'

import { ONLINE_PRICING_KEY, PRICING_KEY, fetchOnlinePrices } from './lib.js'
import {
  parseOnlinePricing,
  parsePricing,
  serializeOnlinePricing,
  serializePricing,
  type OnlinePricingState,
  type PricingTable,
} from '../shared/pricing.js'
import type { ModelUsage } from '../shared/types.js'

export interface PricingController {
  /** User overrides, keyed by provider::model. */
  pricing: PricingTable
  savePricing: (table: PricingTable) => void
  /** Latest fetched online prices, keyed by normalized model id. */
  online: PricingTable
  onlineSource: string
  onlineAt: number
  refreshingOnline: boolean
  onlineError: boolean
  refreshOnline: (models: readonly ModelUsage[]) => Promise<OnlinePricingState | null>
}

const EMPTY_ONLINE: OnlinePricingState = { prices: {}, source: '', fetchedAt: 0 }

function loadOnline(): OnlinePricingState {
  try {
    return parseOnlinePricing(localStorage.getItem(ONLINE_PRICING_KEY)) ?? EMPTY_ONLINE
  } catch {
    return EMPTY_ONLINE
  }
}

export function usePricing(): PricingController {
  const [pricing, setPricing] = useState<PricingTable>(() => {
    try {
      return parsePricing(localStorage.getItem(PRICING_KEY))
    } catch {
      return {}
    }
  })
  const [onlineState, setOnlineState] = useState<OnlinePricingState>(loadOnline)
  const [refreshingOnline, setRefreshingOnline] = useState(false)
  const [onlineError, setOnlineError] = useState(false)

  const savePricing = useCallback((table: PricingTable): void => {
    setPricing(table)
    try {
      localStorage.setItem(PRICING_KEY, serializePricing(table))
    } catch {
      // Private mode: the in-memory table still applies.
    }
  }, [])

  const refreshOnline = useCallback(async (models: readonly ModelUsage[]): Promise<OnlinePricingState | null> => {
    const names = [...new Set(
      models
        .map(model => model.model.trim())
        .filter(model => model !== ''),
    )].slice(0, 100)
    if (names.length === 0) return null
    setRefreshingOnline(true)
    setOnlineError(false)
    try {
      const result = await fetchOnlinePrices(names)
      const next: OnlinePricingState = {
        prices: { ...onlineState.prices, ...result.prices },
        source: result.source === '' ? 'OpenRouter' : result.source,
        fetchedAt: result.fetchedAt,
      }
      setOnlineState(next)
      try {
        localStorage.setItem(ONLINE_PRICING_KEY, serializeOnlinePricing(next))
      } catch {
        // Private mode: keep the fetched table in memory.
      }
      return next
    } catch {
      setOnlineError(true)
      return null
    } finally {
      setRefreshingOnline(false)
    }
  }, [onlineState.prices])

  return {
    pricing,
    savePricing,
    online: onlineState.prices,
    onlineSource: onlineState.source,
    onlineAt: onlineState.fetchedAt,
    refreshingOnline,
    onlineError,
    refreshOnline,
  }
}
