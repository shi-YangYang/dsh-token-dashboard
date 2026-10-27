/** Browser entry: a sidebar-footer entry and its main panel. */

import { createElement as h, Fragment } from 'react'

import { Dashboard } from './App.js'
import { ChartIcon } from './icons.js'
import { en, zh } from './locales.js'
import { FOOTER_CSS } from './styles.js'
import { NS, PANEL_ID } from './lib.js'
import type { ClientContextLike, UiWorkspaceLike } from './lib.js'

export interface ClientPlugin {
  inject: string[]
  apply(ctx: ClientContextLike): void
}

/** Build the Cordis client plugin object the module loader activates. */
export default function createPlugin(): ClientPlugin {
  return {
    inject: ['slots', 'locale', 'layout'],
    apply(ctx: ClientContextLike): void {
      let uiWorkspace: UiWorkspaceLike | undefined
      try {
        ctx.inject?.(['uiWorkspace'], scoped => {
          uiWorkspace = scoped.uiWorkspace
        })
      } catch {
        // Hosts without the optional workspace navigation keep the dashboard.
      }

      ctx.effect(() => {
        const dispose = ctx.locale.register(NS, { zh, en })
        return typeof dispose === 'function' ? dispose as () => void : undefined
      }, 'dsh-token-dashboard: dictionaries')

      const raw = ctx.locale.bind(NS)
      const title = (): string => raw('panel.title')
      const openSession = (id: string): void => {
        try {
          uiWorkspace?.openSession?.(id)
        } catch {
          // A refused navigation needs no dashboard-side recovery.
        }
      }
      let canOpen = uiWorkspace !== undefined
      if (!canOpen && typeof ctx.get === 'function') {
        try {
          canOpen = ctx.get('uiWorkspace') !== undefined
        } catch {
          canOpen = false
        }
      }

      // The main panel is selected by the footer entry, not by a global panel row.
      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
        inject: () => ({ t: raw }),
      }, () => h(Dashboard, {
        locale: ctx.locale,
        ...(canOpen ? { onOpenSession: openSession } : {}),
      })))

      const footerEntry = (owner: { wide?: boolean } = {}): unknown => {
        const wide = owner.wide !== false
        return h(Fragment, {},
          h('style', { key: 'tdb-footer-style' }, FOOTER_CSS),
          h('button', {
            key: 'tdb-footer-button',
            type: 'button',
            className: `tdb-footer-action${wide ? '' : ' tdb-footer-action--rail'}`,
            'aria-label': title(),
            title: title(),
            onClick: () => {
              try {
                ctx.layout.selectPanel(PANEL_ID)
              } catch {
                // The main slot may not be mounted yet; a later click works.
              }
            },
          },
          h(ChartIcon, { size: wide ? 16 : 18 }),
          wide ? h('span', { className: 'tdb-footer-action-label' }, title()) : null))
      }

      ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
        name: 'sidebar.footer.action',
        id: PANEL_ID,
        order: -1,
        label: title,
        locale: NS,
      }, footerEntry as (props: Record<string, unknown>) => unknown))
    },
  }
}
