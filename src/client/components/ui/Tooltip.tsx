/** Small BeUI-surface tooltip for icon-only controls. */

import { cloneElement, createElement as h, useId, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'

import { TooltipSurface } from '../../beui/components/motion/tooltip-surface.js'

export interface TooltipProps {
  content: ReactNode
  children: ReactElement
  placement?: 'top' | 'bottom'
  align?: 'center' | 'end'
}

export function Tooltip({ content, children, placement = 'top', align = 'center' }: TooltipProps): ReactElement {
  const id = useId()
  const [open, setOpen] = useState(false)
  const trigger = cloneElement(children as ReactElement<Record<string, unknown>>, {
    'aria-describedby': open ? id : undefined,
  })

  return h('span', {
    className: 'tdb-tooltip-anchor',
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
  },
  trigger,
  open
    ? h('span', {
      className: `tdb-tooltip-popover tdb-tooltip-popover--${placement}${align === 'end' ? ' tdb-tooltip-popover--end' : ''}`,
    },
    h(TooltipSurface as unknown as (props: Record<string, unknown>) => ReactElement, {
      id,
      ready: true,
      className: 'tdb-tooltip-surface',
      children: content,
    }))
    : null)
}
