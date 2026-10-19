import test from 'node:test'
import assert from 'node:assert/strict'
import { computeAcceptKey, createWsFrame } from '../lib/ws-framer.js'
import { registerHostRoutes } from '../lib/host-routes.js'
import { BaseConfig } from '../lib/schema.js'

test('lib/schema.js defines vadEngine and streamingWs with correct defaults (#279, #282)', () => {
  const cfg = BaseConfig({})
  assert.equal(cfg.vadEngine, 'silero', 'default vadEngine must be silero')
  assert.equal(cfg.streamingWs, true, 'default streamingWs must be true')

  const amplitudeCfg = BaseConfig({ vadEngine: 'amplitude', streamingWs: false })
  assert.equal(amplitudeCfg.vadEngine, 'amplitude')
  assert.equal(amplitudeCfg.streamingWs, false)
})

test('lib/ws-framer.js: computeAcceptKey calculates RFC 6455 Sec-WebSocket-Accept key (#282)', () => {
  const clientKey = 'dGhlIHNhbXBsZSBub25jZQ=='
  const expectedAccept = 's3pPLMBiTxaQ9kYGzzhZRbK+xOo='
  assert.equal(computeAcceptKey(clientKey), expectedAccept)
})

test('lib/ws-framer.js: createWsFrame creates RFC 6455 text and binary frames (#282)', () => {
  // 1. Text frame (opcode 0x01)
  const textMsg = JSON.stringify({ type: 'interim', text: 'hello world' })
  const textFrame = createWsFrame(textMsg, 0x01)
  assert.ok(textFrame instanceof Buffer)
  assert.equal(textFrame[0], 0x81) // FIN + text opcode

  // 2. Binary frame (opcode 0x02)
  const binaryPayload = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05])
  const binaryFrame = createWsFrame(binaryPayload, 0x02)
  assert.equal(binaryFrame[0], 0x82) // FIN + binary opcode
  assert.equal(binaryFrame[1], 5) // length 5
})

test('lib/host-routes.js: GET /dsh-voice/vad/status returns VAD health check (#279)', async () => {
  const routes = {}
  const mockWebServer = {
    register({ path, handler }) { routes[path] = handler; return () => {} },
    registerRoute(path, handler) { routes[path] = handler },
    registerUpgrade() {},
  }
  const mockCtx = {
    webServer: mockWebServer,
    configForms: { get: () => null },
    settingsScope: { get: () => null },
    effect: (fn) => fn(),
  }

  registerHostRoutes(mockCtx, {
    liveConfig: () => ({}),
    isAlive: () => true,
    updateConfig: async () => {},
    daemons: {
      whisperAlive: () => false,
      whisperError: () => '',
      sensevoiceAlive: () => false,
      getSensevoiceError: () => '',
      getWhisperError: () => '',
      startWhisper: () => {},
      startSensevoice: () => {},
    },
  })

  assert.ok(typeof routes['/dsh-voice/vad/status'] === 'function')
  let statusResult = null
  const mockRes = {
    writeHead() {},
    setHeader() {},
    end(jsonStr) {
      if (jsonStr) statusResult = JSON.parse(jsonStr)
    },
  }
  const mockReq = {
    method: 'GET',
    headers: { host: '127.0.0.1:3080' },
    socket: { remoteAddress: '127.0.0.1' },
    connection: { remoteAddress: '127.0.0.1' },
  }
  await routes['/dsh-voice/vad/status'](mockReq, mockRes)
  assert.equal(statusResult.ok, true)
  assert.equal(statusResult.sileroAvailable, true)
  assert.equal(statusResult.sampleRate, 16000)
  assert.equal(statusResult.frameSamples, 512)
})

test('lib/host-routes.js: registerUpgrade mounts WebSocket streaming channel (#282)', async () => {
  let upgradeMounted = false
  let upgradePath = ''
  let upgradeHandler = null

  const mockWebServer = {
    register() { return () => {} },
    registerRoute() {},
    registerUpgrade(arg1, arg2) {
      upgradeMounted = true
      if (typeof arg1 === 'object' && arg1) {
        upgradePath = arg1.path
        upgradeHandler = arg1.handler
      } else {
        upgradePath = arg1
        upgradeHandler = arg2
      }
    },
  }
  const mockCtx = {
    webServer: mockWebServer,
    configForms: { get: () => null },
    settingsScope: { get: () => null },
    effect: (fn) => fn(),
  }

  registerHostRoutes(mockCtx, {
    liveConfig: () => ({ streamingWs: true }),
    isAlive: () => true,
    updateConfig: async () => {},
    daemons: {
      whisperAlive: () => false,
      whisperError: () => '',
      sensevoiceAlive: () => false,
      getSensevoiceError: () => '',
      getWhisperError: () => '',
      startWhisper: () => {},
      startSensevoice: () => {},
    },
  })

  assert.equal(upgradeMounted, true)
  assert.equal(upgradePath, '/dsh-voice/ws/stream')
  assert.ok(typeof upgradeHandler === 'function')

  // Reject missing upgrade header or missing websocket key
  let socketDestroyed = false
  const mockSocket = {
    destroy() { socketDestroyed = true },
    write() {},
    on() {},
  }
  upgradeHandler({ headers: {}, url: '/dsh-voice/ws/stream' }, mockSocket, Buffer.alloc(0))
  assert.equal(socketDestroyed, true)
})

test('client-side Silero VAD evaluates speech harmonic energy vs keystroke transients (#279)', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const vm = await import('node:vm')

  const clientPath = path.resolve('lib/client-src/36-silero-vad.js')
  const code = fs.readFileSync(clientPath, 'utf8')

  const sandbox = {
    voice: {},
    Float32Array,
    Math,
  }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox)

  const vad = sandbox.voice.sileroVad
  assert.ok(vad, 'sileroVad module exported')
  assert.equal(vad.isSupported(), true)
  assert.equal(vad.isReady(), true)

  // 1. Silence: near zero RMS
  const silence = new Float32Array(512)
  const silenceRes = vad.evaluate(silence)
  assert.equal(silenceRes.isSpeech, false)
  assert.ok(silenceRes.probability < 0.2)

  // 2. High frequency click / keystroke (alternating +0.04, -0.04 -> ZCR = 1.0, low RMS)
  const click = new Float32Array(512)
  for (let i = 0; i < click.length; i++) {
    click[i] = (i % 2 === 0 ? 0.04 : -0.04)
  }
  const clickRes = vad.evaluate(click)
  assert.equal(clickRes.isSpeech, false, 'keystroke transient must be classified as non-speech')
  assert.equal(clickRes.probability, 0.12)

  // 3. Human speech harmonic (16kHz sine at 200Hz -> ~80 samples per cycle, moderate ZCR, high RMS)
  const speech = new Float32Array(512)
  for (let i = 0; i < speech.length; i++) {
    speech[i] = 0.3 * Math.sin((2 * Math.PI * 200 * i) / 16000)
  }
  const speechRes = vad.evaluate(speech)
  assert.equal(speechRes.isSpeech, true, 'harmonic vocal audio must be classified as speech')
  assert.ok(speechRes.probability >= 0.45)
})
