#!/usr/bin/env node
/** Compile the unit tests with tsc, then run them with the Node test runner. */
import { readdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await rm(resolve(root, '.test-build'), { recursive: true, force: true })

const tsc = resolve(root, 'node_modules/typescript/bin/tsc')
const compile = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.test.json'], {
  cwd: root,
  stdio: 'inherit',
})
if (compile.status !== 0) process.exit(compile.status ?? 1)

const testDir = resolve(root, '.test-build/test')
const files = (await readdir(testDir))
  .filter(name => name.endsWith('.test.js'))
  .sort()
  .map(name => `.test-build/test/${name}`)

const run = spawnSync(process.execPath, ['--test', ...files], {
  cwd: root,
  stdio: 'inherit',
})
process.exit(run.status ?? 1)
