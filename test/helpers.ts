/** Shared fixtures for the unit tests. */

import type { RawSessionEvent, SessionHeaderLike, UsageSample } from '../src/host/types.js'

export const T0 = new Date(2026, 0, 5, 10, 0, 0).getTime()
export const HOUR = 3_600_000
export const DAY = 86_400_000

export function header(overrides: Partial<SessionHeaderLike> = {}): SessionHeaderLike {
  return {
    id: 'session-a',
    createdAt: T0,
    cwd: '/tmp/project-a',
    isSeeded: false,
    ...overrides,
  }
}

export function ev(
  type: string,
  seq: number,
  time: number,
  data: Record<string, unknown> = {},
): RawSessionEvent {
  return { type, seq, time, data }
}

export function usage(partial: Partial<UsageSample> = {}): UsageSample {
  return {
    inputTokens: 0,
    outputTokens: 0,
    ...partial,
  }
}

export function streamUsage(sample: UsageSample): unknown[] {
  return [{ type: 'chunk', time: T0, chunk: { type: 'usage', usage: sample } }]
}

export function requestHeader(
  seq: number,
  provider: string,
  model: string,
  time = T0,
): RawSessionEvent {
  return ev('request/header', seq, time, {
    header: { config: { provider, model } },
    reason: 'initial',
  })
}

export function assistantMessage(
  seq: number,
  turn: number,
  step: number,
  options: {
    usage?: UsageSample
    stream?: unknown[]
    time?: number
    provider?: string
    model?: string
    interrupted?: true
  } = {},
): RawSessionEvent {
  const data: Record<string, unknown> = {
    turn,
    step,
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: 'assistant text that must never reach the wire' }],
      ...(options.provider === undefined && options.model === undefined
        ? {}
        : {
          source: {
            kind: 'model',
            provider: options.provider ?? 'provider-a',
            model: options.model ?? 'model-a',
          },
        }),
    },
    stream: options.stream ?? [],
  }
  if (options.usage !== undefined) data.usage = options.usage
  if (options.interrupted === true) data.interrupted = true
  return ev('assistant/message', seq, options.time ?? T0, data)
}

export function assistantAttempt(
  seq: number,
  turn: number,
  step: number,
  sample: UsageSample,
  time = T0,
): RawSessionEvent {
  return ev('assistant/attempt', seq, time, {
    turn,
    step,
    stream: streamUsage(sample),
  })
}
