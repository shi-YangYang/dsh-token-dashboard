/** Browser-local pricing table state, shared by the cost row and editor. */

import { useCallback, useState } from 'react'

import { PRICING_KEY } from './lib.js'
import { parsePricing, serializePricing, type PricingTable } from '../shared/pricing.js'

export interface PricingController {
  pricing: PricingTable
  savePricing: (table: PricingTable) => void
}

export function usePricing(): PricingController {
  const [pricing, setPricing] = useState<PricingTable>(() => {
    try {
      return parsePricing(localStorage.getItem(PRICING_KEY))
    } catch {
      return {}
    }
  })

  const savePricing = useCallback((table: PricingTable): void => {
    setPricing(table)
    try {
      localStorage.setItem(PRICING_KEY, serializePricing(table))
    } catch {
      // Private mode: the in-memory table still applies.
    }
  }, [])

  return { pricing, savePricing }
}
