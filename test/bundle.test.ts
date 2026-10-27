import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { en } from '../src/client/locales.js'

interface LoaderDefinition {
  id: string
  factory: (require: NodeRequire) => unknown
}

interface Registered {
  options: Record<string, unknown>
  component: (props?: Record<string, unknown>) => ReactElement
}

async function loadBundle(suffix: string): Promise<LoaderDefinition> {
  const captured: { definition?: LoaderDefinition } = {}
  const previousWindow = (globalThis as unknown as { window?: unknown }).window
  ;(globalThis as unknown as { window: unknown }).window = {
    __ModuleLoader__: {
      load: (definition: LoaderDefinition) => {
        captured.definition = definition
      },
    },
  }
  try {
    const url = new URL('../../client/client.js', import.meta.url)
    url.searchParams.set('bundle', suffix)
    await import(url.href)
    assert.ok(captured.definition, 'the bundle must call __ModuleLoader__.load')
    return captured.definition
  } finally {
    if (previousWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window
    } else {
      ;(globalThis as unknown as { window: unknown }).window = previousWindow
    }
  }
}

test('the built client bundle registers the dashboard plugin factory', async () => {
  const require = createRequire(import.meta.url)
  const definition = await loadBundle('factory')
  assert.equal(definition.id, 'dsh-token-dashboard')
  const plugin = definition.factory(require) as { inject?: string[], apply?: unknown }
  assert.equal(typeof plugin.apply, 'function')
  assert.deepEqual(plugin.inject, ['slots', 'locale', 'layout'])
})

test('the bundle plugin registers the footer entry and the main panel', async () => {
  const require = createRequire(import.meta.url)
  const definition = await loadBundle('apply')
  const plugin = definition.factory(require) as {
    apply: (ctx: unknown) => void
  }

  const injections: string[] = []
  const registrations: Registered[] = []
  let registeredNamespace = ''
  let localeDisposed = false

  const ctx = {
    effect: (callback: () => void | (() => void)): (() => void) => {
      const dispose = callback()
      return typeof dispose === 'function' ? dispose : () => {}
    },
    slots: {
      inject: (name: string, callback: () => unknown): (() => void) => {
        injections.push(name)
        callback()
        return () => {}
      },
      register: (options: Record<string, unknown>, component: (props?: Record<string, unknown>) => ReactElement): (() => void) => {
        registrations.push({ options, component })
        return () => {}
      },
    },
    locale: {
      register: (ns: string): (() => void) => {
        registeredNamespace = ns
        return () => { localeDisposed = true }
      },
      bind: () => (key: string) => en[key] ?? key,
      subscribe: () => () => {},
      getSnapshot: () => ({ id: 'en' }),
    },
    inject: (_services: string[], callback: (scoped: unknown) => void): void => {
      callback({ uiWorkspace: { openSession: () => {} } })
    },
    get: () => undefined,
    layout: { selectPanel: () => {} },
  }

  plugin.apply(ctx)

  assert.equal(registeredNamespace, 'dsh-token-dashboard')
  assert.deepEqual(injections.sort(), ['main', 'sidebar.footer.action'])
  assert.equal(registrations.length, 2)

  const main = registrations.find(item => item.options.name === 'main')
  assert.ok(main)
  assert.equal(main.options.key, 'dsh-token-dashboard')
  const element = main.component({})
  assert.match(renderToStaticMarkup(element), /tdb-root/)
  assert.equal(typeof (element.props as { onOpenSession?: unknown }).onOpenSession, 'function')

  const footer = registrations.find(item => item.options.name === 'sidebar.footer.action')
  assert.ok(footer)
  assert.equal(footer.options.id, 'dsh-token-dashboard')
  assert.equal(footer.options.order, -1)
  const footerMarkup = renderToStaticMarkup(footer.component({ wide: true }))
  assert.match(footerMarkup, /tdb-footer-action/)
  assert.match(footerMarkup, /Token Dashboard/)
  assert.match(footerMarkup, /<svg/)

  assert.equal(localeDisposed, false)
})
