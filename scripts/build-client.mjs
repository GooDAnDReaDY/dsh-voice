#!/usr/bin/env node
// Modular client bundler & size-budget optimizer for lib/client.js (#302).
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const defaultSrcDir = path.join(root, 'lib', 'client-src')
const defaultOutFile = path.join(root, 'lib', 'client.js')
export const MAX_CLIENT_BUNDLE_BYTES = 250 * 1024

export const CLIENT_MODULE_MANIFEST = [
  { id: 'entry/open', file: '00-open.js' },
  { id: 'i18n/locale', file: '10-locale.js' },
  { id: 'styles/composer-css', file: '20-css.js' },
  { id: 'styles/design-tokens', file: '22-design-tokens.js' },
  { id: 'core/code-casing', file: '24-code-casing.js' },
  { id: 'api/client', file: '25-api.js' },
  { id: 'ui/error-boundary', file: '28-error-boundary.js' },
  { id: 'ui/primitives', file: '29-ui-primitives.js' },
  { id: 'core/engine', file: '30-core.js' },
  { id: 'core/webgpu', file: '35-webgpu.js' },
  { id: 'core/silero-vad', file: '36-silero-vad.js' },
  { id: 'core/ws-stream', file: '37-ws-stream.js' },
  { id: 'recording/session', file: '40-recording.js' },
  { id: 'recording/preview', file: '43-preview.js' },
  { id: 'ui/waveform', file: '50-waveform.js' },
  { id: 'ui/composer', file: '60-composer.js' },
  { id: 'settings/draft-store', file: '70-draft-store.js' },
  { id: 'settings/base', file: '70-settings-base.js' },
  { id: 'settings/chains', file: '71-chains.js' },
  { id: 'settings/dashboard', file: '72-dashboard.js' },
  { id: 'settings/dictation-modes', file: '72-dictation-modes.js' },
  { id: 'settings/hardware', file: '72-hardware.js' },
  { id: 'settings/hooks', file: '72-hooks.js' },
  { id: 'settings/jargon', file: '72-jargon.js' },
  { id: 'settings/macros', file: '72-macros.js' },
  { id: 'settings/sensevoice', file: '72-sensevoice.js' },
  { id: 'settings/status-card', file: '72-status-card.js' },
  { id: 'settings/updater', file: '72-updater.js' },
  { id: 'settings/voice-section', file: '72-voice-section.js' },
  { id: 'settings/wizard', file: '72-wizard.js' },
  { id: 'settings/plugin-card', file: '73-plugin-card.js' },
  { id: 'entry/register', file: '80-register.js' },
  { id: 'entry/close', file: '90-close.js' },
]

export function compactClientFragment(source) {
  const lines = source.split('\n')
  const out = []
  let prevTrimmed = ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('//')) continue
    if (prevTrimmed === 'stopped = true' && trimmed.startsWith('try { recognition.abort()')) {
      out.push('        ' + trimmed)
    } else {
      out.push(trimmed)
    }
    prevTrimmed = trimmed
  }
  return out.join('\n') + '\n'
}

export async function buildClientBundle({ srcDir = defaultSrcDir, compact = true } = {}) {
  const files = (await readdir(srcDir)).filter((f) => f.endsWith('.js')).sort()
  if (files.length === 0) throw new Error('no client-src fragments')
  let out = ''
  for (const f of files) {
    const raw = await readFile(path.join(srcDir, f), 'utf8')
    out += compact ? compactClientFragment(raw) : (raw.endsWith('\n') ? raw : raw + '\n')
  }
  // Verify valid JS syntax of compiled bundle
  new vm.Script(out, { filename: 'lib/client.js' })
  const byteLen = Buffer.byteLength(out, 'utf8')
  if (byteLen > MAX_CLIENT_BUNDLE_BYTES) {
    throw new Error(`client bundle (${byteLen} bytes) exceeds 250 KiB budget (${MAX_CLIENT_BUNDLE_BYTES} bytes)`)
  }
  return { code: out, files, bytes: byteLen }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const { code: out, files, bytes } = await buildClientBundle()
  const isCheck = process.argv.includes('--check')
  if (isCheck) {
    let existing = ''
    try { existing = await readFile(defaultOutFile, 'utf8') } catch {}
    if (existing !== out) {
      console.error('build:client parity check failed: lib/client.js does not match compiled client-src bundle. Run "npm run build:client".')
      process.exit(1)
    }
    console.log(`build:client parity check OK (${files.length} modules, ${bytes} bytes)`)
    process.exit(0)
  }
  await writeFile(defaultOutFile, out, 'utf8')
  console.log(`built lib/client.js from ${files.length} modules (${bytes} bytes)`)
}
