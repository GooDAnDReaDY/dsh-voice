import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  SENSEVOICE_MODEL_URL,
  SENSEVOICE_MODEL_MIRROR,
  getDefaultModelDir,
  findModelFile,
  findTokensFile,
  getSensevoiceStatus,
  registerSensevoiceInstaller,
  downloadArchive
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
      register(opts) {
        registered.push(opts)
        return () => { registered.disposed = true }
      }
    }
  }
  const dispose = registerSensevoiceInstaller(mockCtx, {
    liveConfig: () => ({}),
    isAlive: async () => false,
    updateConfig: async () => {},
    startSensevoice: async () => {}
  })

  assert.equal(registered.length, 1)
  assert.equal(registered[0].path, '/dsh-voice/sensevoice-installer')
  assert.equal(typeof dispose, 'function')
  dispose()
  assert.equal(registered.disposed, true)
})

test('downloadArchive writes the response body and closes the file', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-voice-sv-'))
  const dest = path.join(dir, 'model.bin')
  const payload = Buffer.from('sensevoice-bytes')
  const previous = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true,
    headers: { get: () => String(payload.length) },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(payload)
        controller.close()
      },
    }),
  })
  try {
    await downloadArchive('https://example.invalid/model.tar.bz2', dest)
    assert.equal((await readFile(dest)).toString(), 'sensevoice-bytes')
  } finally {
    globalThis.fetch = previous
    await rm(dir, { recursive: true, force: true })
  }
})
