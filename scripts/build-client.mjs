#!/usr/bin/env node
/**
 * Build the browser bundle.
 *
 * The Harness browser module table provides `react`; everything else in the
 * Client half is plain browser code. esbuild emits CommonJS with `react` left
 * external, then this script wraps that output in the single
 * `window.__ModuleLoader__.load({ id, factory })` envelope the Web runtime
 * expects, so the factory's `require` reaches the host React instance.
 */
import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const id = manifest.name

const result = await build({
  entryPoints: [resolve(root, 'src/client/index.ts')],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome110'],
  external: ['react'],
  jsx: 'transform',
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  define: { __TDB_VERSION__: JSON.stringify(manifest.version) },
  legalComments: 'none',
  logLevel: 'warning',
})

const bundled = result.outputFiles?.[0]?.text
if (typeof bundled !== 'string' || bundled.trim() === '') {
  throw new Error('client bundle produced no output')
}

const wrapped = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(id)},
  factory(require) {
    const module = { exports: {} }
    const exports = module.exports
${indent(bundled, 4)}
    const value = module.exports
    return value && value.default ? value.default : value
  },
})
`

const out = resolve(root, 'client/client.js')
await mkdir(dirname(out), { recursive: true })
await writeFile(out, wrapped, 'utf8')
console.log(`built ${out} (${Buffer.byteLength(wrapped)} bytes)`)

function indent(text, spaces) {
  const pad = ' '.repeat(spaces)
  return text
    .split('\n')
    .map(line => (line === '' ? line : pad + line))
    .join('\n')
    .trimEnd()
}
