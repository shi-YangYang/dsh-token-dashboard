/** Token bucket arithmetic shared by Host folding and Client range selection. */

import type { ModelUsage, TokenBuckets } from './types.js'

/** Key used when an event carries no reliable provider/model identity. */
export const UNKNOWN_MODEL_KEY = 'unknown'

/** An all-zero bucket set. */
export function emptyBuckets(): TokenBuckets {
  return { uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 }
}

/** Add every field of `source` into `target` in place. */
export function addBuckets(target: TokenBuckets, source: TokenBuckets): void {
  target.uncachedInputTokens += source.uncachedInputTokens
  target.cacheReadTokens += source.cacheReadTokens
  target.cacheWriteTokens += source.cacheWriteTokens
  target.outputTokens += source.outputTokens
}

/** The official total: the four disjoint buckets summed, never doubled. */
export function totalTokens(buckets: TokenBuckets): number {
  return buckets.uncachedInputTokens + buckets.cacheReadTokens + buckets.cacheWriteTokens + buckets.outputTokens
}

/** Prompt tokens: uncached input plus both cache directions (no output). */
export function inputTokens(buckets: TokenBuckets): number {
  return buckets.uncachedInputTokens + buckets.cacheReadTokens + buckets.cacheWriteTokens
}

/** Cache tokens: reads plus writes. */
export function cacheTokens(buckets: TokenBuckets): number {
  return buckets.cacheReadTokens + buckets.cacheWriteTokens
}

/**
 * Cache hit rate over the prompt side.
 *
 * `cacheRead / (uncachedInput + cacheRead + cacheWrite)`, so every prompt
 * token appears exactly once in the denominator. Zero prompt tokens yield 0.
 */
export function cacheHitRate(buckets: TokenBuckets): number {
  const prompt = inputTokens(buckets)
  return prompt === 0 ? 0 : buckets.cacheReadTokens / prompt
}

/** Stable identity key for one provider/model route. */
export function modelKeyOf(provider: string, model: string): string {
  if (model === '') return UNKNOWN_MODEL_KEY
  return `${provider}::${model}`
}

/** Human label for a model row, with the raw id preserved. */
export function modelLabel(usage: Pick<ModelUsage, 'model' | 'provider'>): string {
  if (usage.model === '') return 'Unknown'
  return usage.model
}

/** Clone a bucket set. */
export function cloneBuckets(buckets: TokenBuckets): TokenBuckets {
  return {
    uncachedInputTokens: buckets.uncachedInputTokens,
    cacheReadTokens: buckets.cacheReadTokens,
    cacheWriteTokens: buckets.cacheWriteTokens,
    outputTokens: buckets.outputTokens,
  }
}

/** A new empty mutable model row. */
export function emptyModel(provider: string, model: string): ModelUsage {
  return { key: modelKeyOf(provider, model), provider, model, requests: 0, ...emptyBuckets() }
}

/** Add one sample into a model row in place. */
export function addModelUsage(target: ModelUsage, source: TokenBuckets, requests: number): void {
  addBuckets(target, source)
  target.requests += requests
}

/** Sort model rows by total tokens descending, then name. */
export function sortModels(models: ModelUsage[]): ModelUsage[] {
  return models.sort((left, right) => {
    const delta = totalTokens(right) - totalTokens(left)
    return delta !== 0 ? delta : left.model.localeCompare(right.model)
  })
}

/** Compare two bucket sets field by field. */
export function bucketsEqual(left: TokenBuckets, right: TokenBuckets): boolean {
  return left.uncachedInputTokens === right.uncachedInputTokens
    && left.cacheReadTokens === right.cacheReadTokens
    && left.cacheWriteTokens === right.cacheWriteTokens
    && left.outputTokens === right.outputTokens
}

/** Subtract every field of `source` from `target` in place. */
export function subtractBuckets(target: TokenBuckets, source: TokenBuckets): void {
  target.uncachedInputTokens -= source.uncachedInputTokens
  target.cacheReadTokens -= source.cacheReadTokens
  target.cacheWriteTokens -= source.cacheWriteTokens
  target.outputTokens -= source.outputTokens
}
