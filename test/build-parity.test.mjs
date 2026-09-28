import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const srcDir = path.join(root, 'lib', 'client-src')
const outFile = path.join(root, 'lib', 'client.js')

test('lib/client.js is strictly identical to concatenated lib/client-src fragments (parity check)', async () => {
  const files = (await readdir(srcDir)).filter((f) => f.endsWith('.js')).sort()
  assert.ok(files.length > 0, 'client-src fragments must exist')
  let expected = ''
  for (const f of files) {
    expected += await readFile(path.join(srcDir, f), 'utf8')
    if (!expected.endsWith('\n')) expected += '\n'
  }
  const actual = await readFile(outFile, 'utf8')
  assert.equal(actual, expected, 'lib/client.js must be in parity with lib/client-src/*.js fragments')
})
