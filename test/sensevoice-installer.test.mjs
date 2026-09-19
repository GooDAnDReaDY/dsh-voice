import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SENSEVOICE_MODEL_URL,
  SENSEVOICE_MODEL_MIRROR,
  getDefaultModelDir,
  findModelFile,
  findTokensFile,
  getSensevoiceStatus,
  registerSensevoiceInstaller
} from '../lib/sensevoice-installer.js'

test('SENSEVOICE URLs are valid https links', () => {
  assert.ok(SENSEVOICE_MODEL_URL.startsWith('https://'))
  assert.ok(SENSEVOICE_MODEL_MIRROR.startsWith('https://'))
  assert.ok(SENSEVOICE_MODEL_URL.includes('sherpa-onnx-sense-voice'))
})

test('getDefaultModelDir returns path containing sensevoice', () => {
  const dir = getDefaultModelDir()
  assert.ok(dir.includes('sensevoice'))
})

test('findModelFile and findTokensFile return null for non-existent directories', () => {
  assert.equal(findModelFile('/non/existent/path/dir'), null)
  assert.equal(findTokensFile('/non/existent/path/dir'), null)
})

test('getSensevoiceStatus returns clean status object without crashing', async () => {
  const status = await getSensevoiceStatus({}, async () => false)
  assert.equal(typeof status.installed, 'boolean')
  assert.equal(typeof status.running, 'boolean')
  assert.equal(status.running, false)
  assert.equal(typeof status.installing, 'boolean')
  assert.equal(typeof status.progress, 'number')
})

test('registerSensevoiceInstaller registers route on ctx.webServer', () => {
  const registered = []
  const mockCtx = {
    webServer: {
      register(opts) { registered.push(opts) }
    }
  }
  registerSensevoiceInstaller(mockCtx, {
    liveConfig: () => ({}),
    isAlive: async () => false,
    updateConfig: async () => {},
    startSensevoice: async () => {}
  })

  assert.equal(registered.length, 1)
  assert.equal(registered[0].path, '/dsh-voice/sensevoice-installer')
})
