import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildClientBundle, CLIENT_MODULE_MANIFEST, MAX_CLIENT_BUNDLE_BYTES } from '../scripts/build-client.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const outFile = path.join(root, 'lib', 'client.js')

test('lib/client.js is strictly identical to compiled lib/client-src modular bundle and fits <250 KiB budget (#302)', async () => {
  const { code: expected, files, bytes } = await buildClientBundle()
  assert.ok(files.length > 0, 'client-src modules must exist')
  assert.ok(CLIENT_MODULE_MANIFEST.length >= 25, 'module manifest must declare client architecture')
  assert.ok(bytes < MAX_CLIENT_BUNDLE_BYTES, `bundle size ${bytes} must be under ${MAX_CLIENT_BUNDLE_BYTES}`)
  const actual = await readFile(outFile, 'utf8')
  assert.equal(actual, expected, 'lib/client.js must be in parity with buildClientBundle() output')
})
