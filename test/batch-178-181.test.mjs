import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isTrustedCaller } from '../lib/http-util.js'
import { BaseConfig, ChainEntry, CustomProvider } from '../lib/schema.js'
import { registerTranscribeAudioTool, MIME_BY_EXT } from '../lib/tool.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

test('Issue #178: client triggerInstallSensevoice passes Content-Type: application/json to pass isTrustedCaller', () => {
  const clientSrc = fs.readFileSync(path.join(rootDir, 'lib', 'client.js'), 'utf8')
  assert.ok(
    clientSrc.includes("fetch('/dsh-voice/sensevoice-installer'"),
    'client must call /dsh-voice/sensevoice-installer'
  )
  assert.ok(
    clientSrc.includes("'Content-Type': 'application/json'") || clientSrc.includes('"Content-Type": "application/json"'),
    'triggerInstallSensevoice must specify Content-Type: application/json'
  )

  // Verify behavior with isTrustedCaller
  const trustedReq = {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3080',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      'x-dsh-plugin-update': '1',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(isTrustedCaller(trustedReq), true, 'POST with application/json must be trusted')

  const untrustedReq = {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3080',
      'sec-fetch-site': 'same-origin',
      'x-dsh-plugin-update': '1',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(isTrustedCaller(untrustedReq), false, 'POST without Content-Type must be rejected by isTrustedCaller')
})

test('Issue #179: modeChain preserves empty auto language and does not force Russian', () => {
  const recordingSrc = fs.readFileSync(path.join(rootDir, 'lib', 'client-src', '40-recording.js'), 'utf8')
  assert.ok(
    !recordingSrc.includes("language: row.language || 'ru'"),
    'must not fall back to ru on empty string'
  )
  assert.ok(
    recordingSrc.includes("language: row.language !== undefined ? row.language : ''")
      || recordingSrc.includes("row.language ?? ''"),
    'must safely preserve empty string for auto-detection'
  )

  // Simulate modeChain logic
  function resolveModeLang(row) {
    return row.language !== undefined ? row.language : ''
  }

  assert.equal(resolveModeLang({ language: '' }), '', 'empty string must stay empty for auto-detect')
  assert.equal(resolveModeLang({ language: 'en' }), 'en', 'explicit English must be preserved')
  assert.equal(resolveModeLang({ language: 'zh' }), 'zh', 'explicit Chinese must be preserved')
  assert.equal(resolveModeLang({}), '', 'omitted language defaults to empty string')
})

test('Issue #180: lib/index.js is decomposed and stays under 600 lines threshold', () => {
  const indexSrc = fs.readFileSync(path.join(rootDir, 'lib', 'index.js'), 'utf8')
  const lines = indexSrc.split('\n').length
  assert.ok(lines < 600, `lib/index.js should be under 600 lines, got ${lines}`)

  assert.ok(BaseConfig, 'BaseConfig must be exported from schema.js')
  assert.ok(ChainEntry, 'ChainEntry must be exported from schema.js')
  assert.ok(CustomProvider, 'CustomProvider must be exported from schema.js')
  assert.ok(typeof registerTranscribeAudioTool === 'function', 'registerTranscribeAudioTool must be exported from tool.js')
  assert.ok(MIME_BY_EXT['.wav'] === 'audio/wav', 'MIME_BY_EXT must map .wav')
})

test('Issue #181: stale child processes are killed before respawning whisper or sensevoice', () => {
  const indexSrc = fs.readFileSync(path.join(rootDir, 'lib', 'index.js'), 'utf8')
  assert.ok(
    indexSrc.includes('if (child && typeof child.kill === \'function\')'),
    'startWhisper must check and kill stale child before starting new process'
  )
  assert.ok(
    indexSrc.includes('if (sensevoiceChild && typeof sensevoiceChild.kill === \'function\')'),
    'startSensevoice must check and kill stale sensevoiceChild before starting new process'
  )
})
