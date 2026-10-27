import test from 'node:test'
import assert from 'node:assert/strict'

import { TokenAggregator } from '../src/host/aggregate.js'
import type { AggregatorSource, SessionDescriptor, SessionReadResult } from '../src/host/source.js'
import type { RawSessionEvent, SessionHeaderLike } from '../src/host/types.js'
import { totalTokens } from '../src/shared/model.js'
import { HOUR, T0, assistantMessage, ev, header, requestHeader, usage } from './helpers.js'

interface FakeSession {
  header: SessionHeaderLike
  events: RawSessionEvent[]
  live: boolean
  revision: string
  inherited: number
  fail: boolean
}

class FakeSource implements AggregatorSource {
  readonly sessions = new Map<string, FakeSession>()
  readonly reads: string[] = []

  add(
    id: string,
    events: RawSessionEvent[],
    options: Partial<Omit<FakeSession, 'header'>> & { header?: Partial<SessionHeaderLike> } = {},
  ): FakeSession {
    const session: FakeSession = {
      header: header({ id, ...(options.header ?? {}) }),
      events,
      live: options.live ?? false,
      revision: options.revision ?? 'r1',
      inherited: options.inherited ?? 0,
      fail: options.fail ?? false,
    }
    this.sessions.set(id, session)
    return session
  }

  async list(): Promise<SessionDescriptor[]> {
    return [...this.sessions.values()].map(session => ({
      id: session.header.id,
      header: session.header,
      live: session.live,
      seq: session.events.length,
      eventCount: session.events.length,
      inheritedEventCount: session.inherited,
      revision: session.revision,
    }))
  }

  async read(descriptor: SessionDescriptor, from: number): Promise<SessionReadResult> {
    this.reads.push(`${descriptor.id}@${from}`)
    const session = this.sessions.get(descriptor.id)
    if (session === undefined || session.fail) throw new Error('read failed')
    return {
      header: session.header,
      inheritedEventCount: session.inherited,
      events: session.events.slice(from),
    }
  }

  projectLabel(cwd: string | undefined): string {
    return cwd === undefined ? '' : 'Project A'
  }
}

function sessionEvents(input: number, output: number): RawSessionEvent[] {
  return [
    requestHeader(0, 'provider-a', 'model-a'),
    assistantMessage(1, 1, 1, {
      usage: usage({ inputTokens: input, outputTokens: output }),
      time: T0,
    }),
  ]
}

function makeAggregator(source: FakeSource): TokenAggregator {
  return new TokenAggregator(source, { now: () => T0 + HOUR, concurrency: 2 })
}

test('first scan aggregates every session, then reuses unchanged revisions', async () => {
  const source = new FakeSource()
  source.add('a', sessionEvents(100, 10))
  source.add('b', sessionEvents(200, 20))
  const aggregator = makeAggregator(source)

  await aggregator.refresh()
  assert.deepEqual(source.reads, ['a@0', 'b@0'])
  const first = aggregator.stats()
  assert.equal(first.totals.uncachedInputTokens, 300)
  assert.equal(first.totals.outputTokens, 30)
  assert.equal(first.requests, 2)
  assert.equal(first.sessionRows.length, 2)
  assert.equal(first.scan.sessionsRead, 2)

  await aggregator.refresh()
  assert.deepEqual(source.reads, ['a@0', 'b@0'])
  const second = aggregator.stats()
  assert.equal(second.revision, first.revision)
  assert.equal(second.scan.sessionsReused, 2)
})

test('a changed revision re-reads only that session and updates totals', async () => {
  const source = new FakeSource()
  source.add('a', sessionEvents(100, 10))
  source.add('b', sessionEvents(200, 20))
  const aggregator = makeAggregator(source)
  await aggregator.refresh()

  const b = source.sessions.get('b')
  assert.ok(b)
  b.events = [...b.events, assistantMessage(2, 2, 1, {
    usage: usage({ inputTokens: 50, outputTokens: 5 }),
    time: T0 + 1000,
  })]
  b.revision = 'r2'
  await aggregator.refresh()

  assert.deepEqual(source.reads, ['a@0', 'b@0', 'b@0'])
  const payload = aggregator.stats()
  assert.equal(payload.totals.uncachedInputTokens, 350)
  assert.equal(payload.totals.outputTokens, 35)
  assert.equal(payload.requests, 3)
})

test('live events fold incrementally without a rescan, and a gap asks for resync', async () => {
  const source = new FakeSource()
  source.add('a', sessionEvents(100, 10), { live: true })
  const aggregator = makeAggregator(source)
  await aggregator.refresh()
  const revision = aggregator.getRevision()

  const next = assistantMessage(2, 2, 1, {
    usage: usage({ inputTokens: 7, outputTokens: 3 }),
    time: T0 + 2000,
  })
  source.sessions.get('a')?.events.push(next)
  assert.equal(aggregator.applyLiveEvent('a', next), true)
  assert.equal(aggregator.getRevision(), revision + 1)
  assert.equal(aggregator.stats().totals.uncachedInputTokens, 107)

  const gap = assistantMessage(4, 3, 1, {
    usage: usage({ inputTokens: 1, outputTokens: 1 }),
    time: T0 + 3000,
  })
  assert.equal(aggregator.applyLiveEvent('a', gap), false)

  const duplicate = aggregator.applyLiveEvent('a', next)
  assert.equal(duplicate, true, 'an already-folded seq is a no-op, not a resync')
})

test('a live session that becomes persisted reuses its fold without another read', async () => {
  const source = new FakeSource()
  source.add('a', sessionEvents(40, 4), { live: true })
  const aggregator = makeAggregator(source)
  await aggregator.refresh()

  const session = source.sessions.get('a')
  assert.ok(session)
  session.live = false
  session.revision = 'persisted-1'
  await aggregator.refresh()

  assert.deepEqual(source.reads, ['a@0'])
  const payload = aggregator.stats()
  assert.equal(payload.sessionRows[0]?.live, false)
  assert.equal(payload.totals.uncachedInputTokens, 40)
})

test('a failed read keeps the last good fold and is reported without content', async () => {
  const source = new FakeSource()
  source.add('a', sessionEvents(10, 1))
  const aggregator = makeAggregator(source)
  await aggregator.refresh()

  const session = source.sessions.get('a')
  assert.ok(session)
  session.fail = true
  session.revision = 'r2'
  await aggregator.refresh()

  const payload = aggregator.stats()
  assert.equal(payload.totals.uncachedInputTokens, 10, 'last good data is retained')
  assert.equal(payload.sessionRows[0]?.stale, true)
  assert.deepEqual(payload.errors, [{ sessionId: 'a', reason: 'read-failed' }])
  assert.equal(payload.scan.partial, true)

  session.fail = false
  await aggregator.refresh()
  const recovered = aggregator.stats()
  assert.equal(recovered.sessionRows[0]?.stale, false)
  assert.deepEqual(recovered.errors, [])
})

test('a session removed from the corpus leaves the aggregate', async () => {
  const source = new FakeSource()
  source.add('a', sessionEvents(10, 1))
  source.add('b', sessionEvents(20, 2))
  const aggregator = makeAggregator(source)
  await aggregator.refresh()
  assert.equal(aggregator.stats().sessionRows.length, 2)

  source.sessions.delete('b')
  await aggregator.refresh()
  const payload = aggregator.stats()
  assert.equal(payload.sessionRows.length, 1)
  assert.equal(payload.totals.uncachedInputTokens, 10)
})

test('session rows expose cache hit rate, model totals, and lifetime usage', async () => {
  const source = new FakeSource()
  source.add('a', [
    requestHeader(0, 'provider-a', 'model-a'),
    assistantMessage(1, 1, 1, {
      usage: usage({ inputTokens: 50, cacheReadTokens: 50, outputTokens: 10 }),
      time: T0,
    }),
  ])
  const aggregator = makeAggregator(source)
  await aggregator.refresh()
  const row = aggregator.stats().sessionRows[0]
  assert.ok(row)
  assert.equal(row.requests, 1)
  assert.equal(row.cacheHitRate, 0.5)
  assert.equal(row.project, 'Project A')
  assert.equal(row.models.length, 1)
  assert.equal(totalTokens(row.totals), 110)
})

test('empty corpus yields a valid empty payload', async () => {
  const source = new FakeSource()
  const aggregator = makeAggregator(source)
  await aggregator.refresh()
  const payload = aggregator.stats()
  assert.equal(payload.sessionRows.length, 0)
  assert.equal(payload.requests, 0)
  assert.equal(payload.cacheHitRate, 0)
  assert.equal(payload.sessions.total, 0)
  assert.deepEqual(payload.errors, [])
})

test('a seeded session keeps inherited usage out of the global aggregate', async () => {
  const source = new FakeSource()
  source.add('parent', [
    requestHeader(0, 'provider-a', 'model-a'),
    assistantMessage(1, 1, 1, { usage: usage({ inputTokens: 100, outputTokens: 10 }) }),
  ])
  source.add('child', [
    requestHeader(0, 'provider-a', 'model-a'),
    assistantMessage(1, 1, 1, { usage: usage({ inputTokens: 100, outputTokens: 10 }) }),
    ev('session/end-seed', 2, T0, {}),
    assistantMessage(3, 2, 1, { usage: usage({ inputTokens: 5, outputTokens: 1 }) }),
  ], { inherited: 3, header: { isSeeded: true, parentSession: 'parent' } })

  const aggregator = makeAggregator(source)
  await aggregator.refresh()
  const payload = aggregator.stats()

  assert.equal(payload.totals.uncachedInputTokens, 105, 'inherited 100 counted once, in the parent')
  assert.equal(payload.totals.outputTokens, 11)
  assert.equal(payload.sessions.seeded, 1)
  assert.equal(payload.sessions.total, 2)
})
