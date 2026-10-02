import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

test('batch-183-187: issue #183 - ctx.slots.inject and host ctx.on are wrapped in ctx.effect with disposers', () => {
  const indexSrc = fs.readFileSync(path.join(rootDir, 'lib', 'index.js'), 'utf8')
  const composerSrc = fs.readFileSync(path.join(rootDir, 'lib', 'client-src', '60-composer.js'), 'utf8')
  const cardSrc = fs.readFileSync(path.join(rootDir, 'lib', 'client-src', '73-plugin-card.js'), 'utf8')

  // Host ctx.on wrapped in ctx.effect
  assert.match(indexSrc, /ctx\.effect\(\(\)\s*=>\s*ctx\.on\('loader\/volatile-update'/, 'loader/volatile-update must be in ctx.effect')
  assert.match(indexSrc, /ctx\.effect\(\(\)\s*=>\s*ctx\.on\('settings\/document-updated'/, 'settings/document-updated must be in ctx.effect')
  assert.match(indexSrc, /ctx\.effect\(\(\)\s*=>\s*ctx\.on\('config'/, 'config must be in ctx.effect')

  // Client slots wrapped in ctx.effect with cleanup
  assert.match(composerSrc, /ctx\.effect\(\(\)\s*=>\s*\{[\s\S]*?ctx\.slots\.inject\('conversation\.input\.right'[\s\S]*?return\s*\(\)\s*=>\s*\{/, 'composer slots must be in ctx.effect with cleanup')
  assert.match(cardSrc, /ctx\.effect\(\(\)\s*=>\s*\{[\s\S]*?ctx\.slots\.inject\('plugins\.item'[\s\S]*?return\s*\(\)\s*=>\s*\{/, 'plugin card slots must be in ctx.effect with cleanup')
})

test('batch-183-187: issue #184 - modularity check: all source files strictly under 600 lines', () => {
  const clientSrcDir = path.join(rootDir, 'lib', 'client-src')
  const libDir = path.join(rootDir, 'lib')

  const clientFiles = fs.readdirSync(clientSrcDir).filter(f => f.endsWith('.js'))
  for (const f of clientFiles) {
    const lines = fs.readFileSync(path.join(clientSrcDir, f), 'utf8').split('\n').length
    assert.ok(lines <= 600, `lib/client-src/${f} has ${lines} lines, must be <= 600`)
  }

  const backendFiles = fs.readdirSync(libDir).filter(f => f.endsWith('.js') && f !== 'client.js')
  for (const f of backendFiles) {
    const lines = fs.readFileSync(path.join(libDir, f), 'utf8').split('\n').length
    assert.ok(lines <= 600, `lib/${f} has ${lines} lines, must be <= 600`)
  }
})

test('batch-183-187: issue #185 - ChainEditor and CustomEditor accept props.t and avoid identifier shadowing', () => {
  const chainsSrc = fs.readFileSync(path.join(rootDir, 'lib', 'client-src', '71-chains.js'), 'utf8')
  const sectionSrc = fs.readFileSync(path.join(rootDir, 'lib', 'client-src', '72-voice-section.js'), 'utf8')

  assert.match(chainsSrc, /function ChainEditor\(props\)\s*\{[\s\S]*?const t = \(props && props\.t\) \|\| moduleT/, 'ChainEditor must declare localized t from props')
  assert.match(chainsSrc, /function CustomEditor\(props\)\s*\{[\s\S]*?const t = \(props && props\.t\) \|\| moduleT/, 'CustomEditor must declare localized t from props')
  assert.doesNotMatch(chainsSrc, /TEMPLATES\.map\(\(t\)\s*=>/, 'CustomEditor must not shadow t in TEMPLATES.map')

  assert.match(sectionSrc, /React\.createElement\(ChainEditor,\s*\{[\s\S]*?t:\s*t,/, 'VoiceSection must pass t to ChainEditor')
  assert.match(sectionSrc, /React\.createElement\(CustomEditor,\s*\{[\s\S]*?t:\s*t,/, 'VoiceSection must pass t to CustomEditor')
})

test('batch-183-187: issue #186 - dead imports removed from lib/index.js and lib/sensevoice-installer.js', () => {
  const indexSrc = fs.readFileSync(path.join(rootDir, 'lib', 'index.js'), 'utf8')
  const senseSrc = fs.readFileSync(path.join(rootDir, 'lib', 'sensevoice-installer.js'), 'utf8')

  // lib/index.js must not import removed entities
  assert.doesNotMatch(indexSrc, /import\s*\{[^}]*defineTool[^}]*\}\s*from/, 'defineTool must not be imported in index.js')
  assert.doesNotMatch(indexSrc, /import\s*\{[^}]*stat[^}]*\}\s*from\s*'node:fs\/promises'/, 'stat must not be imported in index.js')
  assert.doesNotMatch(indexSrc, /import\s*\{[^}]*PROVIDER_KEYS[^}]*\}\s*from/, 'PROVIDER_KEYS must not be imported in index.js')
  assert.doesNotMatch(indexSrc, /import\s*\{[^}]*normalizePhrase[^}]*\}\s*from/, 'normalizePhrase must not be imported in index.js')
  assert.doesNotMatch(indexSrc, /import\s*\{[^}]*getAllowedAudioRoots[^}]*\}\s*from/, 'getAllowedAudioRoots must not be imported in index.js')

  // lib/sensevoice-installer.js must not import stat
  assert.doesNotMatch(senseSrc, /import\s*\{[^}]*stat[^}]*\}\s*from\s*'node:fs\/promises'/, 'stat must not be imported in sensevoice-installer.js')
})

test('batch-183-187: issue #187 - docs/design/DESIGN.md documents all live endpoints, tools, and UI slots', () => {
  const designSrc = fs.readFileSync(path.join(rootDir, 'docs', 'design', 'DESIGN.md'), 'utf8')

  assert.match(designSrc, /\/dsh-voice\/config/, 'DESIGN.md must document /config')
  assert.match(designSrc, /\/dsh-voice\/sensevoice-installer/, 'DESIGN.md must document /sensevoice-installer')
  assert.match(designSrc, /api\/dsh-voice\/update/, 'DESIGN.md must document updater endpoint')
  assert.match(designSrc, /transcribe_audio/, 'DESIGN.md must document transcribe_audio tool')
  assert.match(designSrc, /plugins\.item/, 'DESIGN.md must document plugins.item slot')
  assert.match(designSrc, /plugins\.row\.config/, 'DESIGN.md must document plugins.row.config slot')
  assert.doesNotMatch(designSrc, /Documentation:.*index\.md/, 'DESIGN.md must not list index.md under Documentation')
})
