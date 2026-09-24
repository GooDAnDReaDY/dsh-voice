import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexSrc = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')

test('lib/index.js wires autostart to deferred settings injection and updates', () => {
  // 1. triggerAutostart helper exists
  assert.match(indexSrc, /function triggerAutostart\(\)/, 'must define triggerAutostart helper')

  // 2. Called on ctx.inject(['settings']) callback
  assert.match(indexSrc, /ctx\.inject\(\['settings'\], \(sctx\) => \{[\s\S]*?triggerAutostart\(\)/, 'must call triggerAutostart in settings inject')

  // 3. Subscribed to scope.watch
  assert.match(indexSrc, /scope\.watch\(\(\) => \{[\s\S]*?triggerAutostart\(\)/, 'must call triggerAutostart on scope.watch')

  // 4. Subscribed to modern DSH events
  assert.match(indexSrc, /ctx\.on\('loader\/volatile-update', \(\) => triggerAutostart\(\)\)/, 'must listen to loader/volatile-update')
  assert.match(indexSrc, /ctx\.on\('settings\/document-updated', \(\) => triggerAutostart\(\)\)/, 'must listen to settings/document-updated')
  assert.match(indexSrc, /ctx\.on\('config', \(\) => triggerAutostart\(\)\)/, 'must listen to config event')
})

test('startWhisper and startSensevoice have 30s timeout and premature exit guards', () => {
  // Polling loop 60 * 500ms = 30s in startWhisper
  assert.match(indexSrc, /for \(let i = 0; i < 60; i\+\+\) \{[\s\S]*?whisperAlive\(\)[\s\S]*?child\.exitCode/, 'startWhisper must poll up to 60 iterations with premature exit check')

  // Polling loop 60 * 500ms = 30s in startSensevoice
  assert.match(indexSrc, /for \(let i = 0; i < 60; i\+\+\) \{[\s\S]*?sensevoiceAlive\(\)[\s\S]*?sensevoiceChild\.exitCode/, 'startSensevoice must poll up to 60 iterations with premature exit check')
})

test('autostart dispatch lifecycle simulator', async () => {
  let whisperStarted = 0
  let sensevoiceStarted = 0

  let config = { autoStart: false, whisperModel: '', sensevoiceAutostart: false, sensevoiceModel: '' }

  async function mockStartWhisper() {
    if (!config.autoStart || !config.whisperModel) return false
    whisperStarted++
    return true
  }

  async function mockStartSensevoice() {
    if (!config.sensevoiceAutostart || !config.sensevoiceModel) return false
    sensevoiceStarted++
    return true
  }

  function triggerAutostart() {
    mockStartWhisper()
    mockStartSensevoice()
  }

  // Initial apply() with defaults: autostart does not run
  triggerAutostart()
  assert.equal(whisperStarted, 0)
  assert.equal(sensevoiceStarted, 0)

  // Settings service deferred fiber resolves
  const listeners = []
  const mockSctx = {
    settings: {
      register() {
        return {
          get: () => config,
          watch(fn) { listeners.push(fn) }
        }
      }
    }
  }

  // Simulate settings loaded with autoStart enabled
  config = { autoStart: true, whisperModel: '/path/to/ggml.bin', sensevoiceAutostart: true, sensevoiceModel: '/path/to/model' }
  const scope = mockSctx.settings.register()
  scope.watch(() => triggerAutostart())

  // Deferred inject finishes
  triggerAutostart()
  assert.equal(whisperStarted, 1)
  assert.equal(sensevoiceStarted, 1)

  // Setting changed dynamically via watch
  listeners[0]()
  assert.equal(whisperStarted, 2)
  assert.equal(sensevoiceStarted, 2)
})
