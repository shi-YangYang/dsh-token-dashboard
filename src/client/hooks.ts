/** Reusable React hooks for the dashboard. */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

import type { StatsPayload } from '../shared/types.js'
import type { LocaleLike, LocaleSnapshot } from './lib.js'
import { POLL_INTERVAL_MS, fetchStats } from './lib.js'

/** Track an element's content-box width; 0 until the first measurement. */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (node === null || typeof ResizeObserver === 'undefined') return
    const update = (): void => setWidth(node.getBoundingClientRect().width)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}

export interface ElementSize {
  width: number
  height: number
}

/** Observe both dimensions of an element (used by the growable charts). */
export function useElementSize<T extends HTMLElement>(): [RefObject<T | null>, ElementSize] {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  useEffect(() => {
    const node = ref.current
    if (node === null || typeof ResizeObserver === 'undefined') return
    const update = (): void => {
      const rect = node.getBoundingClientRect()
      setSize(current => (
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height }
      ))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, size]
}

/** Re-render periodically so relative timestamps stay current. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

/** Keep the latest locale snapshot without assuming a cached getSnapshot. */
export function useLocaleSnapshot(locale: LocaleLike): LocaleSnapshot {
  const [snapshot, setSnapshot] = useState<LocaleSnapshot>(() => {
    try {
      return locale.getSnapshot()
    } catch {
      return {}
    }
  })

  useEffect(() => {
    let alive = true
    const refresh = (): void => {
      if (!alive) return
      try {
        setSnapshot(locale.getSnapshot())
      } catch {
        // A locale change during teardown is not an error.
      }
    }
    const unsubscribe = locale.subscribe(refresh)
    refresh()
    return () => {
      alive = false
      try {
        unsubscribe()
      } catch {
        // Already disposed by the locale service.
      }
    }
  }, [locale])

  return snapshot
}

export interface StatsController {
  data: StatsPayload | null
  loading: boolean
  refreshing: boolean
  error: string | null
  pollError: string | null
  lastUpdated: number | null
  refresh: () => void
}

/**
 * Load and poll the dashboard payload.
 *
 * Polling sends the previous ETag, so an unchanged Host revision costs one 304
 * with no body. A hidden tab polls nothing.
 */
export function useStats(): StatsController {
  const [data, setData] = useState<StatsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const etag = useRef<string | null>(null)
  const inflight = useRef<AbortController | null>(null)
  const hasData = useRef(false)

  const load = useCallback(async (mode: 'initial' | 'poll' | 'manual'): Promise<void> => {
    if (mode === 'poll' && inflight.current !== null) return
    if (mode === 'manual' && inflight.current !== null) inflight.current.abort()
    const controller = new AbortController()
    inflight.current = controller
    if (mode === 'manual') setRefreshing(true)
    try {
      const result = await fetchStats(mode === 'manual', mode === 'manual' ? null : etag.current, controller.signal)
      if (result === null) return
      etag.current = result.etag
      hasData.current = true
      setData(result.payload)
      setError(null)
      setPollError(null)
      setLastUpdated(Date.now())
    } catch (cause) {
      if (controller.signal.aborted) return
      const message = cause instanceof Error ? cause.message : 'request failed'
      if (hasData.current) setPollError(message)
      else setError(message)
    } finally {
      if (mode === 'manual') setRefreshing(false)
      setLoading(false)
      if (inflight.current === controller) inflight.current = null
    }
  }, [])

  useEffect(() => {
    void load('initial')
  }, [load])

  useEffect(() => {
    const tick = (): void => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      void load('poll')
    }
    const timer = setInterval(tick, POLL_INTERVAL_MS)
    const onVisibility = (): void => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      inflight.current?.abort()
    }
  }, [load])

  const refresh = useCallback((): void => {
    void load('manual')
  }, [load])

  return { data, loading, refreshing, error, pollError, lastUpdated, refresh }
}

/** Escape-to-close plus initial focus for a simple modal. */
export function useModal(open: boolean, onClose: () => void): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const listener = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close.current()
      }
    }
    document.addEventListener('keydown', listener)
    const timer = setTimeout(() => {
      const focusable = ref.current?.querySelector<HTMLElement>('[data-autofocus]')
      focusable?.focus()
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', listener)
      previous?.focus()
    }
  }, [open])

  return ref
}
