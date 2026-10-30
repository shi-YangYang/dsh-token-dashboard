import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createElement as h } from 'react'

import { DatePicker } from '../src/client/components/ui/DatePicker.js'
import { Select } from '../src/client/components/ui/Select.js'

test('the custom select opens a listbox and reports the chosen value', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
  const globals = globalThis as unknown as Record<string, unknown>
  globals.window = dom.window
  globals.document = dom.window.document
  globals.HTMLElement = dom.window.HTMLElement
  globals.Node = dom.window.Node
  globals.IS_REACT_ACT_ENVIRONMENT = true

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
    assert.equal(container.querySelector('.tdb-select-menu'), null)
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    dom.window.close()
  }
})

test('the custom date picker opens a calendar and reports the chosen day', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
  const globals = globalThis as unknown as Record<string, unknown>
  globals.window = dom.window
  globals.document = dom.window.document
  globals.HTMLElement = dom.window.HTMLElement
  globals.Node = dom.window.Node
  globals.IS_REACT_ACT_ENVIRONMENT = true

  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react-dom/test-utils')
  const container = dom.window.document.createElement('div')
  dom.window.document.body.append(container)
  const root = createRoot(container)
  let chosen = '2026-01-05'

  try {
    await act(async () => {
      root.render(h(DatePicker, {
        value: '2026-01-05',
        ariaLabel: 'Pick a date',
        intl: 'en-US',
        previousLabel: 'Previous month',
        nextLabel: 'Next month',
        onChange: (value: string) => { chosen = value },
      }))
    })
    const trigger = container.querySelector<HTMLButtonElement>('.tdb-date-trigger')
    assert.ok(trigger)
    await act(async () => {
      trigger.click()
    })
    assert.ok(container.querySelector('.tdb-date-popover'))
    const day = Array.from(container.querySelectorAll<HTMLButtonElement>('.tdb-cal-day'))
      .find(button => button.textContent === '6')
    assert.ok(day)
    await act(async () => {
      day.click()
    })
    assert.equal(chosen, '2026-01-06')
    assert.equal(container.querySelector('.tdb-date-popover'), null)
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    dom.window.close()
  }
})
