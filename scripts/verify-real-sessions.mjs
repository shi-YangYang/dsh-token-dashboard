#!/usr/bin/env node
/**
 * Real-log verification (development aid, read-only).
 *
 * This script deliberately does NOT use the plugin's Host runtime or the DSH
 * services. It reads the on-disk session logs directly, folds them with the
 * compiled production fold, and compares the result with an independent
 * reference fold written here. That catches double counting and bucket
 * arithmetic errors against the user's actual history.
 *
 * Output contains counters only: no prompt text, assistant text, titles, cwd,
 * file paths, or ids.
 *
 * Usage: node scripts/verify-real-sessions.mjs [root]
 * Default root: $DSH_HOME/sessions or ~/.dsh/sessions
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const foldPath = join(projectRoot, 'lib/host/fold.js')

let foldSession
let TokenAggregator
try {
  ({ foldSession } = await import(foldPath))
  ;({ TokenAggregator } = await import(join(projectRoot, 'lib/host/aggregate.js')))
} catch {
  console.error('Build the plugin first: npm run build')
  process.exit(1)
}

const root = resolve(process.argv[2] ?? join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'sessions'))
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

const files = await collectSessionFiles(root)
if (files.length === 0) {
  console.error(`No session logs found under ${root}`)
  process.exit(1)
}

const totals = { uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 }
const referenceTotals = { uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 }
let requests = 0
let referenceRequests = 0
let events = 0
let usageEvents = 0
let retryEvents = 0
let attemptEvents = 0
let titles = 0
let inheritedSessions = 0
let inheritedEvents = 0
let mismatchedSessions = 0
let modelMismatches = 0
let parseFailures = 0
let dayBuckets = 0
const modelTotals = new Map()
const mismatches = []
const parsedSessions = []

for (const file of files) {
  let text
  try {
    text = file.endsWith('.zstd') ? decompressFrames(await readFile(file)) : await readFile(file, 'utf8')
  } catch {
    parseFailures += 1
    continue
  }
  const lines = text.split('\n').filter(line => line.trim() !== '')
  let header
  try {
    header = JSON.parse(lines[0] ?? '{}')
  } catch {
    parseFailures += 1
    continue
  }
  const rawEvents = []
  for (const line of lines.slice(1)) {
    try {
      rawEvents.push(JSON.parse(line))
    } catch {
      parseFailures += 1
    }
  }
  rawEvents.sort((left, right) => Number(left.seq) - Number(right.seq))

  // Verification-only cut. The runtime asks SessionHandle for the authoritative
  // `inheritedEventCount`; the on-disk marker is enough to check arithmetic.
  let inherited = 0
  if (header.isSeeded === true) {
    const markers = rawEvents.filter(event => event?.type === 'session/end-seed')
    const last = markers[markers.length - 1]
    inherited = last === undefined ? 0 : Number(last.seq) + 1
  }
  if (inherited > 0) {
    inheritedSessions += 1
    inheritedEvents += inherited
  }

  const aggregate = foldSession(header, rawEvents, inherited, { now: Date.now() })
  const reference = referenceFold(rawEvents, inherited)
  const info = await stat(file)
  parsedSessions.push({
    header,
    events: rawEvents,
    inherited,
    revision: `${info.mtimeMs}:${info.size}`,
  })

  events += rawEvents.length
  usageEvents += reference.usageEvents
  retryEvents += reference.retryEvents
  attemptEvents += reference.attemptEvents
  titles += aggregate.title === null ? 0 : 1
  requests += aggregate.requests
  referenceRequests += reference.requests
  dayBuckets += Object.keys(aggregate.days).length
  addInto(totals, aggregate.totals)
  addInto(referenceTotals, reference.totals)

  for (const model of Object.values(aggregate.models)) {
    const current = modelTotals.get(model.key) ?? { model: model.model, provider: model.provider, tokens: 0, requests: 0 }
    current.tokens += model.uncachedInputTokens + model.cacheReadTokens + model.cacheWriteTokens + model.outputTokens
    current.requests += model.requests
    modelTotals.set(model.key, current)
  }

  const sameTotals = sameBuckets(aggregate.totals, reference.totals)
  const sameRequests = aggregate.requests === reference.requests
  const sameModels = sameModelRows(aggregate.models, reference.models)
  if (!sameTotals || !sameRequests || !sameModels) {
    mismatchedSessions += 1
    if (!sameModels) modelMismatches += 1
    mismatches.push({
      session: String(header.id ?? '').slice(0, 14),
      own: aggregate.requests,
      reference: reference.requests,
      totalsMatch: sameTotals,
      modelsMatch: sameModels,
    })
  }
}

const totalsMatch = sameBuckets(totals, referenceTotals) && requests === referenceRequests
const aggregatorCheck = await runAggregator(parsedSessions, totals, requests)
const summary = {
  rootKind: 'local sessions',
  files: files.length,
  events,
  usageSamples: usageEvents,
  retryEvents,
  attemptEvents,
  titles,
  inheritedSessions,
  inheritedEvents,
  requests,
  referenceRequests,
  tokens: {
    total: totals.uncachedInputTokens + totals.cacheReadTokens + totals.cacheWriteTokens + totals.outputTokens,
    ...totals,
  },
  cacheHitRate: ratio(totals.cacheReadTokens, totals.uncachedInputTokens + totals.cacheReadTokens + totals.cacheWriteTokens),
  days: dayBuckets,
  models: [...modelTotals.values()]
    .sort((left, right) => right.tokens - left.tokens)
    .slice(0, 8)
    .map(model => `${model.model || '(unknown)'}${model.provider === '' ? '' : ` @ ${model.provider}`}: ${model.tokens} tokens / ${model.requests} req`),
  parseFailures,
  mismatchedSessions,
  modelMismatches,
  totalsMatch,
  mismatches: mismatches.slice(0, 5),
  aggregator: aggregatorCheck,
}

console.log(JSON.stringify(summary, null, 2))
process.exit(
  totalsMatch
    && mismatchedSessions === 0
    && parseFailures === 0
    && aggregatorCheck.totalsMatch
    && aggregatorCheck.readsOnSecondPass === 0
    ? 0
    : 1,
)

async function runAggregator(sessions, expectedTotals, expectedRequests) {
  const byId = new Map(sessions.map(session => [String(session.header.id), session]))
  const source = {
    async list() {
      return sessions.map(session => ({
        id: String(session.header.id),
        header: session.header,
        live: false,
        seq: session.events.length,
        eventCount: session.events.length,
        inheritedEventCount: session.inherited,
        revision: session.revision,
      }))
    },
    async read(descriptor, from) {
      const session = byId.get(descriptor.id)
      if (session === undefined) throw new Error('missing session')
      return {
        header: session.header,
        inheritedEventCount: session.inherited,
        events: session.events.slice(from),
      }
    },
    projectLabel: cwd => (cwd === undefined ? '' : 'project'),
  }

  const aggregator = new TokenAggregator(source, { now: () => Date.now() })
  await aggregator.refresh()
  const first = aggregator.stats()
  const firstReads = first.scan.sessionsRead
  await aggregator.refresh()
  const second = aggregator.stats()
  return {
    sessions: first.sessionRows.length,
    readsOnFirstPass: firstReads,
    readsOnSecondPass: second.scan.sessionsRead,
    reusedOnSecondPass: second.scan.sessionsReused,
    totalsMatch: sameBuckets(first.totals, expectedTotals) && first.requests === expectedRequests,
    revisionStable: first.revision === second.revision,
    errors: first.errors.length,
  }
}

function referenceFold(rawEvents, inherited) {
  let last = null
  let requests = 0
  let usageEvents = 0
  let retryEvents = 0
  let attemptEvents = 0
  const totals = { uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 }
  const models = new Map()

  for (const event of rawEvents) {
    const seq = Number(event?.seq)
    if (!Number.isFinite(seq) || seq < inherited) continue
    const data = event?.data ?? {}
    if (event.type === 'llm/retry-started') {
      retryEvents += 1
      if (last !== null && last.turn === data.turn && last.step === data.step) last = null
      continue
    }
    if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') continue
    if (event.type === 'assistant/attempt') attemptEvents += 1
    const usage = readUsage(event)
    if (usage === undefined) continue
    usageEvents += 1
    const buckets = {
      uncachedInputTokens: nonNegative(usage.inputTokens),
      cacheReadTokens: nonNegative(usage.cacheReadTokens),
      cacheWriteTokens: nonNegative(usage.cacheWriteTokens),
      outputTokens: nonNegative(usage.outputTokens),
    }
    const model = identityOf(event, rawEvents, seq)
    const previous = last !== null && last.turn === data.turn && last.step === data.step ? last : null
    if (previous === null) requests += 1
    else {
      subtract(totals, previous.buckets)
      subtractModel(models, previous)
    }
    add(totals, buckets)
    addModel(models, model, buckets, previous === null ? 1 : 1)
    if (previous !== null) {
      // The replacement moves the one request from the old row to the new one.
      const oldRow = models.get(previous.key)
      if (oldRow !== undefined) {
        oldRow.requests -= 1
        if (oldRow.requests <= 0 && totalOf(oldRow) <= 0) models.delete(previous.key)
      }
    }
    last = { turn: data.turn, step: data.step, buckets, key: model.key }
  }

  return { totals, requests, models, usageEvents, retryEvents, attemptEvents }
}

function identityOf(event, rawEvents, seq) {
  if (event.type === 'assistant/message') {
    const source = event?.data?.message?.source
    if (source?.kind === 'model' && typeof source.model === 'string' && source.model !== '') {
      return { key: `${source.provider ?? ''}::${source.model}`, provider: source.provider ?? '', model: source.model }
    }
  }
  for (let index = seq - 1; index >= 0; index -= 1) {
    const candidate = rawEvents[index]
    if (candidate?.type !== 'request/header') continue
    const config = candidate?.data?.header?.config
    if (config?.model) return { key: `${config.provider ?? ''}::${config.model}`, provider: config.provider ?? '', model: config.model }
    break
  }
  return { key: 'unknown', provider: '', model: '' }
}

function readUsage(event) {
  const data = event?.data ?? {}
  if (event.type === 'assistant/message' && data.usage && typeof data.usage === 'object') return data.usage
  const stream = Array.isArray(data.stream) ? data.stream : []
  for (let index = stream.length - 1; index >= 0; index -= 1) {
    const record = stream[index]
    if (record?.type === 'chunk' && record?.chunk?.type === 'usage' && record.chunk.usage) return record.chunk.usage
  }
  return undefined
}

function sameModelRows(actual, reference) {
  const actualRows = new Map(Object.entries(actual).map(([key, row]) => [key, row]))
  if (actualRows.size !== reference.size) return false
  for (const [key, row] of reference) {
    const other = actualRows.get(key)
    if (other === undefined) return false
    if (other.requests !== row.requests) return false
    if (!sameBuckets(other, row)) return false
  }
  return true
}

function addModel(models, model, buckets, requests) {
  const row = models.get(model.key) ?? {
    provider: model.provider,
    model: model.model,
    requests: 0,
    uncachedInputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
  }
  add(row, buckets)
  row.requests += requests
  models.set(model.key, row)
}

function subtractModel(models, previous) {
  const row = models.get(previous.key)
  if (row === undefined) return
  subtract(row, previous.buckets)
}

function add(target, source) {
  target.uncachedInputTokens += source.uncachedInputTokens
  target.cacheReadTokens += source.cacheReadTokens
  target.cacheWriteTokens += source.cacheWriteTokens
  target.outputTokens += source.outputTokens
}

function subtract(target, source) {
  target.uncachedInputTokens -= source.uncachedInputTokens
  target.cacheReadTokens -= source.cacheReadTokens
  target.cacheWriteTokens -= source.cacheWriteTokens
  target.outputTokens -= source.outputTokens
}

function addInto(target, source) {
  add(target, source)
}

function sameBuckets(left, right) {
  return left.uncachedInputTokens === right.uncachedInputTokens
    && left.cacheReadTokens === right.cacheReadTokens
    && left.cacheWriteTokens === right.cacheWriteTokens
    && left.outputTokens === right.outputTokens
}

function totalOf(row) {
  return row.uncachedInputTokens + row.cacheReadTokens + row.cacheWriteTokens + row.outputTokens
}

function nonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

function ratio(part, whole) {
  return whole > 0 ? Number((part / whole).toFixed(4)) : 0
}

async function collectSessionFiles(rootDir) {
  const result = []
  let projects
  try {
    projects = await readdir(rootDir, { withFileTypes: true })
  } catch {
    return result
  }
  for (const project of projects) {
    if (!project.isDirectory()) continue
    const projectDir = join(rootDir, project.name)
    let sessions
    try {
      sessions = await readdir(projectDir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const session of sessions) {
      if (!session.isDirectory()) continue
      const sessionDir = join(projectDir, session.name)
      let names
      try {
        names = await readdir(sessionDir)
      } catch {
        continue
      }
      let best = null
      for (const name of names) {
        if (!/^session(\.v\d+)?\.jsonl(\.zstd)?$/.test(name)) continue
        const version = name.startsWith('session.v') ? Number(name.slice(9, name.indexOf('.jsonl'))) : 0
        if (!Number.isFinite(version)) continue
        if (best === null || version > best.version) best = { name, version }
      }
      if (best === null) continue
      const path = join(sessionDir, best.name)
      try {
        const info = await stat(path)
        if (info.isFile()) result.push(path)
      } catch {
        // Unreadable log stays out of the verification.
      }
    }
  }
  return result
}

function decompressFrames(bytes) {
  const starts = []
  let index = bytes.indexOf(MAGIC, 0)
  while (index !== -1) {
    starts.push(index)
    index = bytes.indexOf(MAGIC, index + 1)
  }
  const parts = []
  for (let position = 0; position < starts.length; position += 1) {
    const end = position + 1 < starts.length ? starts[position + 1] : bytes.length
    try {
      parts.push(zstdDecompressSync(bytes.subarray(starts[position], end)))
    } catch {
      // A magic-like sequence inside a frame: merge with the next candidate.
      const next = position + 2 < starts.length ? starts[position + 2] : bytes.length
      try {
        parts.push(zstdDecompressSync(bytes.subarray(starts[position], next)))
        position += 1
      } catch {
        // Frame boundaries were unrecoverable; the caller reports a parse failure.
      }
    }
  }
  return Buffer.concat(parts).toString('utf8')
}
