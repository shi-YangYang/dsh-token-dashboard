/** Browser entry: register the sidebar row and its main panel. */

import { createElement as h } from 'react'

import { Dashboard } from './App.js'
import { PanelIcon } from './icons.js'
import { en, zh } from './locales.js'
import { NS, PANEL_ID } from './lib.js'
import type { ClientContextLike, UiWorkspaceLike } from './lib.js'

const SIDEBAR_ORDER = 6

export interface ClientPlugin {
  inject: string[]
  apply(ctx: ClientContextLike): void
}

/** Build the Cordis client plugin object the module loader activates. */
export default function createPlugin(): ClientPlugin {
  return {
    inject: ['slots', 'locale'],
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

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
        inject: () => ({ t: raw }),
      }, () => h(Dashboard, {
        locale: ctx.locale,
        ...(canOpen ? { onOpenSession: openSession } : {}),
      })))

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: SIDEBAR_ORDER,
        label: () => raw('panel.title'),
        locale: NS,
      }, (owner: { size?: number; active?: boolean } = {}) => h(PanelIcon, {
        size: owner.size ?? 18,
        active: owner.active === true,
      })))
    },
  }
}
