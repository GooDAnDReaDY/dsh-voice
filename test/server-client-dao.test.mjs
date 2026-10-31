import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServerDaemons } from '../lib/server-daemons.js'
import { createServerPipeline, registerServerTools } from '../lib/server-tools.js'
import { registerServerRoutes } from '../lib/server-routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

test('Issue #304: lib/index.js is a compact orchestrator under 100 lines and delegates to server modules', () => {
  const indexSrc = fs.readFileSync(path.join(rootDir, 'lib', 'index.js'), 'utf8')
  const lines = indexSrc.trim().split('\n').length
  assert.ok(lines < 100, `lib/index.js must be < 100 lines, got ${lines}`)
  assert.equal(typeof createServerDaemons, 'function')
  assert.equal(typeof createServerPipeline, 'function')
  assert.equal(typeof registerServerTools, 'function')
  assert.equal(typeof registerServerRoutes, 'function')
})

test('Issue #304: registerServerRoutes mounts routes via isolated RouteDeps contract', () => {
  const registeredRoutes = []
  const effects = []
  const mockCtx = {
    webServer: {
      register(spec) {
        registeredRoutes.push(spec.path)
        return () => {}
      },
    },
    effect(fn, label) {
      effects.push(label)
      fn()
    },
  }
  registerServerRoutes(mockCtx, {
    NS: 'dsh-voice',
    live: () => ({}),
    daemons: {
      whisperAlive: async () => false,
      sensevoiceAlive: async () => false,
      startWhisper: async () => false,
      startSensevoice: async () => false,
      getWhisperState: () => ({ state: 'STOPPED' }),
      getSensevoiceState: () => ({ state: 'STOPPED' }),
      getWhisperError: () => '',
      getSensevoiceError: () => '',
    },
    statsTracker: { record() {}, snapshot: () => ({}) },
    transcribe: async () => ({ text: 'ok', provider: 'groq' }),
    polishText: async (t) => t,
    getSettingsService: () => null,
    getScope: () => null,
    updateConfig: async () => {},
    triggerAutostart: () => {},
  })
  assert.ok(registeredRoutes.includes('/dsh-voice/status'))
  assert.ok(registeredRoutes.includes('/dsh-voice/transcribe'))
  assert.ok(effects.includes('dsh-voice: config route'))
})

test('Issue #307: all client HTTP and WebSocket calls are encapsulated inside 25-api.js apiClient', () => {
  const clientSrcDir = path.join(rootDir, 'lib', 'client-src')
  const files = fs.readdirSync(clientSrcDir).filter((f) => f.endsWith('.js')).sort()
  assert.ok(files.includes('25-api.js'), '25-api.js must exist')
  const apiSrc = fs.readFileSync(path.join(clientSrcDir, '25-api.js'), 'utf8')
  assert.match(apiSrc, /const apiClient = \{/, '25-api.js must define apiClient')
  for (const file of files) {
    if (file === '25-api.js') continue
    const content = fs.readFileSync(path.join(clientSrcDir, file), 'utf8')
    assert.ok(!content.includes('fetch('), `${file} must not call raw fetch() directly`)
    assert.ok(!content.includes('new WebSocket('), `${file} must not call new WebSocket() directly`)
  }
})
