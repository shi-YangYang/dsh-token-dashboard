import test from 'node:test'
import assert from 'node:assert/strict'

import { createDshSource } from '../src/host/source.js'
import type {
  LiveSessionLike,
  PersistenceHandle,
  PersistenceSnapshot,
  RawSessionEvent,
} from '../src/host/types.js'
import { T0, assistantMessage, header, requestHeader, usage } from './helpers.js'

const persistedHeader = header({ id: 'persisted-1' })
const liveHeader = header({ id: 'live-1', createdAt: T0 + 10 })

const events: RawSessionEvent[] = [
  requestHeader(0, 'provider-a', 'model-a'),
  assistantMessage(1, 1, 1, { usage: usage({ inputTokens: 10, outputTokens: 2 }) }),
]

test('list merges persisted and live sessions, with the live view winning', async () => {
  const snapshots: PersistenceSnapshot[] = [
    { header: persistedHeader, revision: 'rev-1', eventCount: 2 },
    { header: liveHeader, revision: 'rev-2', eventCount: 1 },
  ]
  const live: LiveSessionLike = {
    id: 'live-1',
    header: liveHeader,
    inheritedEventCount: 0,
    seq: 2,
    snapshotEvents: () => events,
  }
  const source = createDshSource({
    persistence: () => ({
      list: async () => snapshots,
      open: async () => { throw new Error('not used') },
    }),
    sessions: () => ({ list: () => [live], get: id => (id === 'live-1' ? live : undefined) }),
    sessionQuery: () => undefined,
    workspaces: () => ({
      list: () => [{ path: '/tmp/project-a', title: 'Workspace A' }],
    }),
  })

  const descriptors = await source.list()
  assert.equal(descriptors.length, 2)
  const liveDescriptor = descriptors.find(item => item.id === 'live-1')
  assert.equal(liveDescriptor?.live, true)
  assert.equal(liveDescriptor?.seq, 2)
  assert.equal(liveDescriptor?.revision, 'rev-2')
  assert.equal(source.projectLabel?.('/tmp/project-a'), 'Workspace A')
  assert.equal(source.projectLabel?.('/tmp/other'), 'other')
  assert.equal(source.projectLabel?.(undefined), '')
})

test('a persisted read is read-only and closes its handle', async () => {
  let closed = false
  let openedWith = ''
  const handle: PersistenceHandle = {
    id: 'persisted-1',
    header: persistedHeader,
    inheritedEventCount: 0,
    read: async offset => ({ events: events.slice(offset ?? 0) }),
    close: async () => { closed = true },
  }
  const source = createDshSource({
    persistence: () => ({
      list: async () => [{ header: persistedHeader, revision: 'rev-1', eventCount: events.length }],
      open: async (id: string, access: 'read' | 'write') => {
        openedWith = `${id}:${access}`
        return handle
      },
    }),
    sessions: () => undefined,
    sessionQuery: () => undefined,
    workspaces: () => undefined,
  })

  const [descriptor] = await source.list()
  assert.ok(descriptor)
  const result = await source.read(descriptor, 0)
  assert.equal(openedWith, 'persisted-1:read')
  assert.equal(result.events.length, 2)
  assert.equal(result.inheritedEventCount, 0)
  assert.equal(closed, true)
})

test('a live read snapshots only the requested tail', async () => {
  const calls: Array<[number, number]> = []
  const live: LiveSessionLike = {
    id: 'live-1',
    header: liveHeader,
    inheritedEventCount: 2,
    seq: 5,
    snapshotEvents: (from: number, to: number) => {
      calls.push([from, to])
      return events.slice(from, to)
    },
  }
  const source = createDshSource({
    persistence: () => ({
      list: async () => [],
      open: async () => { throw new Error('not used') },
    }),
    sessions: () => ({ list: () => [live], get: id => (id === 'live-1' ? live : undefined) }),
    sessionQuery: () => undefined,
    workspaces: () => undefined,
  })

  const [descriptor] = await source.list()
  assert.ok(descriptor)
  const result = await source.read(descriptor, 3)
  assert.deepEqual(calls, [[3, 5]])
  assert.equal(result.inheritedEventCount, 2)
  assert.equal(result.events.length, 0)
})

test('projection reads expose tokenUsage and release the observation lease', async () => {
  let disposed = false
  const source = createDshSource({
    persistence: () => ({
      list: async () => [],
      open: async () => { throw new Error('not used') },
    }),
    sessions: () => undefined,
    sessionQuery: () => ({
      observeSession: async () => ({
        projections: {
          values: {
            tokenUsage: {
              uncachedInputTokens: 11,
              cacheReadTokens: 22,
              cacheWriteTokens: 3,
              outputTokens: 44,
            },
          },
        },
        dispose: () => { disposed = true },
      }),
    }),
    workspaces: () => undefined,
  })

  const usageProjection = await source.projectUsage?.('persisted-1')
  assert.deepEqual(usageProjection, {
    uncachedInputTokens: 11,
    cacheReadTokens: 22,
    cacheWriteTokens: 3,
    outputTokens: 44,
  })
  assert.equal(disposed, true)
})

test('an unknown projection is reported as unavailable instead of guessed', async () => {
  const source = createDshSource({
    persistence: () => ({
      list: async () => [],
      open: async () => { throw new Error('not used') },
    }),
    sessions: () => undefined,
    sessionQuery: () => ({ observeSession: async () => ({}) }),
    workspaces: () => undefined,
  })
  assert.equal(await source.projectUsage?.('x'), undefined)
})

test('a descriptor without a usable header is ignored', async () => {
  const broken = { revision: 'r', eventCount: 1 } as unknown as PersistenceSnapshot
  const source = createDshSource({
    persistence: () => ({
      list: async () => [broken],
      open: async () => { throw new Error('not used') },
    }),
    sessions: () => undefined,
    sessionQuery: () => undefined,
    workspaces: () => undefined,
  })
  assert.deepEqual(await source.list(), [])
})

