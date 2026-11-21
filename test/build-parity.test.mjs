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

test('Issue #352: CLIENT_MODULE_MANIFEST strictly matches client-src directory bidirectionally', async () => {
  const srcDir = path.join(root, 'lib', 'client-src')
  const { readdir } = await import('node:fs/promises')
  const onDisk = (await readdir(srcDir)).filter((f) => f.endsWith('.js')).sort()

  const inManifest = CLIENT_MODULE_MANIFEST.map((m) => m.file)
  assert.equal(CLIENT_MODULE_MANIFEST.length, 37, 'must have exactly 37 manifest fragments')
  assert.deepEqual(inManifest, onDisk, 'manifest files must match on-disk files exactly in sorted order')

  for (const m of CLIENT_MODULE_MANIFEST) {
    assert.ok(m.id && typeof m.id === 'string', `manifest entry must have id: ${JSON.stringify(m)}`)
    assert.ok(m.file && typeof m.file === 'string', `manifest entry must have file: ${JSON.stringify(m)}`)
  }
})
