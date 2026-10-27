/** Dashboard-local language preference, independent of the host locale. */

import { useSyncExternalStore } from 'react'

export type Language = 'zh' | 'en'

export const LANGUAGE_KEY = 'dsh-token-dashboard:language:v1'

let current: Language = 'en'
let initialized = false
const listeners = new Set<() => void>()

function persist(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_KEY, language)
  } catch {
    // Private mode: the in-memory choice still applies.
  }
}

function stored(): Language | null {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY)
    return value === 'zh' || value === 'en' ? value : null
  } catch {
    return null
  }
}

function emit(): void {
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      // A subscriber unmounted during notification.
    }
  }
}

/** Map a host locale id to the dashboard language. */
export function languageFromLocale(id: string | undefined): Language {
  return id !== undefined && id.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

/** Initialize once from the stored choice, then the host locale. */
export function initLanguage(fallback: Language): Language {
  if (!initialized) {
    current = stored() ?? fallback
    initialized = true
  }
  return current
}

/** Current language. */
export function getLanguage(): Language {
  return current
}

/** Persist and publish a language choice. */
export function setLanguage(next: Language): void {
  initialized = true
  if (next === current) {
    persist(next)
    return
  }
  current = next
  persist(next)
  emit()
}

/** Subscribe to language changes. */
export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** React binding for the language store. */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage)
}
