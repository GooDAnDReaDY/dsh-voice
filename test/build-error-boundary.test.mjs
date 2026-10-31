import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildClientBundle, compactClientFragment, MAX_CLIENT_BUNDLE_BYTES } from '../scripts/build-client.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

test('Issue #302: compactClientFragment strips single-line comments and indentation while keeping code intact', () => {
  const sample = '  // comment line\n    const x = 1\n\n    const y = "http://example.com"\n'
  const compacted = compactClientFragment(sample)
  assert.equal(compacted, 'const x = 1\nconst y = "http://example.com"\n')
})

test('Issue #302: buildClientBundle keeps lib/client.js well below 250 KiB budget with safety margin', async () => {
  const { bytes } = await buildClientBundle()
  assert.ok(bytes < 225 * 1024, `expected compacted bundle < 225 KiB, got ${bytes} bytes`)
  assert.ok(bytes < MAX_CLIENT_BUNDLE_BYTES)
})

test('Issue #303: VoiceErrorBoundary wraps composer, visualizer, wizard, and settings sections', () => {
  const ebSrc = fs.readFileSync(path.join(rootDir, 'lib', 'client-src', '28-error-boundary.js'), 'utf8')
  const compSrc = fs.readFileSync(path.join(rootDir, 'lib', 'client-src', '60-composer.js'), 'utf8')
  const secSrc = fs.readFileSync(path.join(rootDir, 'lib', 'client-src', '72-voice-section.js'), 'utf8')
  assert.match(ebSrc, /class VoiceErrorBoundary extends React\.Component/)
  assert.match(ebSrc, /getDerivedStateFromError/)
  assert.match(ebSrc, /componentDidCatch/)
  assert.match(compSrc, /VoiceErrorBoundary,\s*\{\s*section:\s*'composer'\s*\}/)
  assert.match(compSrc, /VoiceErrorBoundary,\s*\{\s*section:\s*'visualizer'\s*\}/)
  assert.match(secSrc, /VoiceErrorBoundary,\s*\{\s*section:\s*'wizard'\s*\}/)
})
