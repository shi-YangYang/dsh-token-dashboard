/** Original inline icons. The sidebar mark inherits the host's current color. */

import { createElement as h } from 'react'
import type { ReactElement, ReactNode } from 'react'

export interface IconProps {
  size?: number
}

/** Sidebar panel icon: three ascending bars and a token dot. */
export function PanelIcon({ size = 18, active = false }: IconProps & { active?: boolean }): ReactElement {
  return (
    <svg
      className="tdb-nav-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      fill="none"
    >
      <rect x="3.4" y="13.2" width="4.1" height="7" rx="1.3" fill="currentColor" opacity={active ? 0.95 : 0.72} />
      <rect x="9.9" y="9" width="4.1" height="11.2" rx="1.3" fill="currentColor" opacity={active ? 1 : 0.86} />
      <rect x="16.4" y="4.6" width="4.1" height="15.6" rx="1.3" fill="currentColor" />
      <circle cx="19.1" cy="19.2" r="1.7" fill="var(--dsw-alias-state-success-primary, #16a34a)" />
    </svg>
  )
}

function Stroke({ size = 16, children }: IconProps & { children: ReactNode }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function RefreshIcon(props: IconProps): ReactElement {
  return (
    <Stroke {...props}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4.5V11h-6.4" />
    </Stroke>
  )
}

export function DownloadIcon(props: IconProps): ReactElement {
  return (
    <Stroke {...props}>
      <path d="M12 3.5v11" />
      <path d="m7.7 10.4 4.3 4.3 4.3-4.3" />
      <path d="M4.5 19.5h15" />
    </Stroke>
  )
}

export function SearchIcon(props: IconProps): ReactElement {
  return (
    <Stroke {...props}>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.6 15.6 4 4" />
    </Stroke>
  )
}

export function CloseIcon(props: IconProps): ReactElement {
  return (
    <Stroke {...props}>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </Stroke>
  )
}

export function ChevronDownIcon(props: IconProps): ReactElement {
  return (
    <Stroke {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </Stroke>
  )
}

export function ChevronLeftIcon(props: IconProps): ReactElement {
  return (
    <Stroke {...props}>
      <path d="m14.5 6-6 6 6 6" />
    </Stroke>
  )
}

export function ChevronRightIcon(props: IconProps): ReactElement {
  return (
    <Stroke {...props}>
      <path d="m9.5 6 6 6-6 6" />
    </Stroke>
  )
}

export function AlertIcon(props: IconProps): ReactElement {
  return (
    <Stroke {...props}>
      <path d="M12 4.2 21 19.5H3L12 4.2Z" />
      <path d="M12 9.6v4.2" />
      <circle cx="12" cy="16.6" r="0.9" fill="currentColor" stroke="none" />
    </Stroke>
  )
}

export function InfoIcon(props: IconProps): ReactElement {
  return (
    <Stroke {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 10.8v5.2" />
      <circle cx="12" cy="7.9" r="0.9" fill="currentColor" stroke="none" />
    </Stroke>
  )
}

export function DatabaseIcon(props: IconProps): ReactElement {
  return (
    <Stroke {...props}>
      <ellipse cx="12" cy="6.4" rx="7" ry="2.8" />
      <path d="M5 6.4v11.2c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6.4" />
      <path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" />
    </Stroke>
  )
}

export function CopyIcon(props: IconProps): ReactElement {
  return (
    <Stroke {...props}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.2" />
      <path d="M15.5 8.5V6.7a2.2 2.2 0 0 0-2.2-2.2H6.7a2.2 2.2 0 0 0-2.2 2.2v6.6a2.2 2.2 0 0 0 2.2 2.2h1.8" />
    </Stroke>
  )
}

export function ChartIcon(props: IconProps): ReactElement {
  return (
    <Stroke {...props}>
      <path d="M4 19.5h16" />
      <path d="M6.5 16.5v-4" />
      <path d="M11 16.5V8" />
      <path d="M15.5 16.5v-6.5" />
      <path d="M20 16.5V5.5" />
    </Stroke>
  )
}

export function CheckIcon(props: IconProps): ReactElement {
  return (
    <Stroke {...props}>
      <path d="m5 12.5 4.4 4.4L19 7.3" />
    </Stroke>
  )
}

export function CoinIcon(props: IconProps): ReactElement {
  return (
    <Stroke {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M14.6 9.2c-.6-.7-1.5-1.1-2.6-1.1-1.6 0-2.7.8-2.7 2 0 1.2 1.1 1.8 2.9 2.1 1.8.3 2.8.9 2.8 2.1 0 1.3-1.2 2.1-3 2.1-1.2 0-2.2-.4-2.8-1.2" />
      <path d="M12 6.6v10.8" />
    </Stroke>
  )
}

export function ArrowRightIcon(props: IconProps): ReactElement {
  return (
    <Stroke {...props}>
      <path d="M4.5 12h14" />
      <path d="m13.5 7 5 5-5 5" />
    </Stroke>
  )
}

export function SparkIcon(props: IconProps): ReactElement {
  return (
    <Stroke {...props}>
      <path d="M12 4.5 13.7 9l4.5 1.7-4.5 1.7L12 17l-1.7-4.6L5.8 10.7 10.3 9 12 4.5Z" />
      <path d="M18.5 16.5 19.2 18l1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7.7-1.5Z" />
    </Stroke>
  )
}
