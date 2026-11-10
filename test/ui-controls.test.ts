import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createElement as h } from 'react'
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverMock {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

import { Select } from '../src/client/components/ui/Select.js'

test('the beUI select opens a listbox and reports the chosen value', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
  const globals = globalThis as unknown as Record<string, unknown>
  globals.window = dom.window
  globals.document = dom.window.document
  globals.HTMLElement = dom.window.HTMLElement
  globals.Node = dom.window.Node
  globals.IS_REACT_ACT_ENVIRONMENT = true
  globals.Element = dom.window.Element
  globals.SVGElement = dom.window.SVGElement
  globals.Event = dom.window.Event
  globals.MouseEvent = dom.window.MouseEvent
  globals.PointerEvent = (dom.window as unknown as { PointerEvent?: unknown }).PointerEvent ?? dom.window.MouseEvent
  globals.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
  globals.requestAnimationFrame = (callback: FrameRequestCallback): number => window.setTimeout(() => callback(Date.now()), 0)
  globals.cancelAnimationFrame = (handle: number): void => window.clearTimeout(handle)
  const media = (query: string): MediaQueryList => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList
  globals.matchMedia = media
  dom.window.matchMedia = media

  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react-dom/test-utils')
  const container = dom.window.document.createElement('div')
  dom.window.document.body.append(container)
  const root = createRoot(container)
  let chosen = 'a'

  try {
    await act(async () => {
      root.render(h(Select, {
        value: 'a',
        ariaLabel: 'Pick one',
        options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }],
        onChange: (value: string) => { chosen = value },
      }))
    })
    const trigger = container.querySelector<HTMLButtonElement>('.tdb-select-trigger')
    assert.ok(trigger)
    await act(async () => {
      trigger.click()
    })
    assert.ok(container.querySelector('.tdb-select-menu'))
    const beta = Array.from(container.querySelectorAll<HTMLButtonElement>('.tdb-select-option'))
      .find(option => option.textContent === 'Beta')
    assert.ok(beta)
    await act(async () => {
      beta.click()
    })
    assert.equal(chosen, 'b')
    assert.equal(container.querySelector('.tdb-select-menu')?.getAttribute('aria-hidden'), 'true')
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    dom.window.close()
  }
})


