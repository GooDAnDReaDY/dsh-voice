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
  downloadArchive,
  redactModelPath
} from '../lib/sensevoice-installer.js'
import { mockReq, mockRes, jsonBody } from './helpers/mock-http.mjs'

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
    await rm(dir, { recursive: true })
  }
})


test('redactModelPath removes absolute path prefix and preserves .dsh/models location', () => {
  assert.equal(redactModelPath('/home/vadim/.dsh/models/sensevoice/model.int8.onnx'), '~/.dsh/models/sensevoice/model.int8.onnx')
  assert.equal(redactModelPath('C:\\Users\\vadim\\.dsh\\models\\sensevoice\\tokens.txt'), '~/.dsh/models/sensevoice/tokens.txt')
  assert.equal(redactModelPath('/opt/secret/models/model.bin'), 'model.bin')
  assert.equal(redactModelPath(''), '')
})

test('registerSensevoiceInstaller route guards GET and POST against untrusted callers (#153)', async () => {
  let routeHandler = null
  const mockCtx = {
    webServer: {
      register(opts) {
        routeHandler = opts.handler
        return () => {}
      }
    }
  }
  registerSensevoiceInstaller(mockCtx, {
    liveConfig: () => ({}),
    isAlive: async () => false,
    updateConfig: async () => {},
    startSensevoice: async () => {}
  })

  // 1. Untrusted GET -> 403
  const untrustedGetReq = mockReq('GET')
  untrustedGetReq.socket = { remoteAddress: '192.168.1.150' }
  untrustedGetReq.headers = { host: 'example.com' }
  const getRes = mockRes()
  await routeHandler(untrustedGetReq, getRes)
  assert.equal(getRes.statusCode, 403)
  assert.equal(jsonBody(getRes).ok, false)

  // 2. Untrusted POST -> 403
  const untrustedPostReq = mockReq('POST')
  untrustedPostReq.socket = { remoteAddress: '192.168.1.150' }
  untrustedPostReq.headers = { host: 'example.com' }
  const postRes = mockRes()
  await routeHandler(untrustedPostReq, postRes)
  assert.equal(postRes.statusCode, 403)
  assert.equal(jsonBody(postRes).ok, false)

  // 3. Trusted loopback GET -> 200 and no absolute paths
  const trustedGetReq = mockReq('GET')
  trustedGetReq.socket = { remoteAddress: '127.0.0.1' }
  trustedGetReq.headers = { host: 'localhost:3080' }
  const trustedRes = mockRes()
  await routeHandler(trustedGetReq, trustedRes)
  assert.equal(trustedRes.statusCode, 200)
  const body = jsonBody(trustedRes)
  assert.equal(typeof body.installed, 'boolean')
  assert.equal(typeof body.running, 'boolean')
  // Verify no absolute path leaks (no /home/, no /mnt/, no /Users/)
  if (body.modelPath) {
    assert.ok(!body.modelPath.startsWith('/home/'), 'modelPath must not leak /home/')
    assert.ok(!body.modelPath.startsWith('/mnt/'), 'modelPath must not leak /mnt/')
    assert.ok(!body.modelPath.includes(':\\'), 'modelPath must not leak Windows drive')
  }
  if (body.tokensPath) {
    assert.ok(!body.tokensPath.startsWith('/home/'), 'tokensPath must not leak /home/')
  }
})

test('lib/index.js wires SenseVoice installer updateConfig to modern SettingsForms settingsService (#193)', async () => {
  const indexSource = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8')
  assert.match(indexSource, /settingsService\.replace/, 'must support settingsService.replace')
  assert.match(indexSource, /settingsService\.update/, 'must support settingsService.update')
  assert.match(indexSource, /updateConfig: async \(patch\) => \{[\s\S]*?settingsService/, 'installer updateConfig must wire to settingsService')
})

import { resolveSensevoiceProvider } from '../lib/sensevoice-installer.js'

test('resolveSensevoiceProvider truthfully resolves effective provider and CPU fallback (#221)', () => {
  // 1. Default / unspecified provider resolves to cpu
  assert.equal(resolveSensevoiceProvider({}), 'cpu')
  assert.equal(resolveSensevoiceProvider({ sensevoiceProvider: 'cpu' }), 'cpu')
  assert.equal(resolveSensevoiceProvider({ sensevoiceProvider: '' }), 'cpu')

  // 2. Configured rknn with standard ONNX model resolves to cpu (truthful CPU fallback)
  assert.equal(resolveSensevoiceProvider({
    sensevoiceProvider: 'rknn',
    sensevoiceModel: '/nonexistent/path/model.int8.onnx',
  }), 'cpu')

  // 3. Configured rknn with .rknn model resolves to rknn
  assert.equal(resolveSensevoiceProvider({
    sensevoiceProvider: 'rknn',
    sensevoiceModel: '/opt/models/model.rknn',
  }), 'rknn')

  // 4. Legacy rknpu normalizes and behaves truthfully
  assert.equal(resolveSensevoiceProvider({
    sensevoiceProvider: 'rknpu',
    sensevoiceModel: 'model.int8.onnx',
  }), 'cpu')

  // 5. Other custom providers pass through
  assert.equal(resolveSensevoiceProvider({ sensevoiceProvider: 'cuda' }), 'cuda')
})
