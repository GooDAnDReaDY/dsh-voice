// test/streaming-quota.test.mjs — Quota and efficiency verification for WebSocket streaming (#293)
import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { getVoiceSessionToken } from '../lib/http-util.js'
import { createWsFrame } from '../lib/ws-framer.js'

test('Issue #293: interim streaming processes only latest chunk and skips cloud providers', async () => {
  const { registerHostRoutes } = await import('../lib/host-routes.js')
  let upgradeHandler = null
  const mockCtx = {
    effect: (fn) => fn(),
    webServer: {
      register: () => () => {},
      registerUpgrade(opts) {
        if (opts.path === '/dsh-voice/ws/stream') upgradeHandler = opts.handler
        return () => {}
      },
    },
  }

  const transcribedChunks = []
  const transcribedConfigs = []

  let mockWhisperRunning = false
  let mockSensevoiceRunning = true

  const mockLiveConfig = {
    timeoutMs: 5000,
    voiceActions: false,
    dictation: {
      // Default chain begins with cloud providers: deepgram, groq, sensevoice
      chain: [
        { provider: 'deepgram', model: 'nova-2' },
        { provider: 'groq', model: 'whisper-large-v3' },
        { provider: 'sensevoice', model: 'default' },
      ],
      language: 'ru',
    },
    message: { chain: [], language: 'ru' },
  }

  registerHostRoutes(mockCtx, {
    live: () => mockLiveConfig,
    daemons: {
      whisperAlive: async () => mockWhisperRunning,
      sensevoiceAlive: async () => mockSensevoiceRunning,
      getWhisperError: () => null,
      getSensevoiceError: () => null,
      startWhisper: async () => {},
      startSensevoice: async () => {},
    },
    statsTracker: {},
    transcribe: async (modeCfg, bytes, mime, signal) => {
      transcribedChunks.push(bytes)
      transcribedConfigs.push(modeCfg)
      return { text: 'тестовое распознавание', provider: modeCfg.chain[0]?.provider || 'sensevoice' }
    },
    polishText: async () => '',
    sessionCommand: () => null,
    extractVoiceActions: () => ({}),
    applyJargonDictionary: (t) => t,
    KNOWN_KEYS: ['deepgram', 'groq', 'sensevoice', 'local-whisper'],
  })

  assert.ok(upgradeHandler, 'upgrade handler must be registered')

  const token = getVoiceSessionToken()
  const socket = new EventEmitter()
  socket.writable = true
  const writtenFrames = []
  socket.write = (chunk) => {
    writtenFrames.push(chunk)
    return true
  }
  socket.destroy = () => {}
  socket.remoteAddress = '127.0.0.1'

  const req = {
    url: `/dsh-voice/ws/stream?token=${token}`,
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      host: '127.0.0.1:3000',
      origin: 'http://127.0.0.1:3000',
      'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
      'sec-websocket-version': '13',
    },
  }

  upgradeHandler(req, socket, Buffer.alloc(0))

  // 1. Send init message
  socket.emit('data', createWsFrame(JSON.stringify({ type: 'init', mimeType: 'audio/webm', mode: 'dictation' })))

  // 2. Send Chunk 1 (4000 bytes)
  const chunk1 = Buffer.alloc(4000, 1)
  socket.emit('data', createWsFrame(chunk1, 0x02))

  // 3. Request interim
  socket.emit('data', createWsFrame(JSON.stringify({ type: 'interim' })))

  // Allow async tasks to run
  await new Promise((r) => setTimeout(r, 100))

  assert.equal(transcribedChunks.length, 1, 'interim must trigger transcribe once')
  assert.equal(transcribedChunks[0].length, 4000, 'interim must process chunk1 (4000 bytes)')
  assert.equal(transcribedConfigs[0].chain.length, 1, 'cloud providers must be stripped from interim chain')
  assert.equal(transcribedConfigs[0].chain[0].provider, 'sensevoice', 'only local engine must remain')
  assert.equal(transcribedConfigs[0].polish, false, 'interim must disable polish')

  // 4. Send Chunk 2 (5000 bytes)
  const chunk2 = Buffer.alloc(5000, 2)
  socket.emit('data', createWsFrame(chunk2, 0x02))

  // 5. Request second interim
  socket.emit('data', createWsFrame(JSON.stringify({ type: 'interim' })))
  await new Promise((r) => setTimeout(r, 100))

  assert.equal(transcribedChunks.length, 2, 'second interim must trigger second transcribe')
  // CRITICAL CHECK FOR #293: second interim must ONLY process chunk 2 (5000 bytes), NOT chunk1+chunk2 (9000 bytes)!
  assert.equal(transcribedChunks[1].length, 5000, 'interim must process ONLY latest chunk (5000 bytes), not full history')

  // Verify total audio transcribed by interim is linear O(N) = 4000 + 5000 = 9000 bytes,
  // NOT quadratic O(N^2) = 4000 + 9000 = 13000 bytes!
  const totalInterimBytes = transcribedChunks.reduce((acc, c) => acc + c.length, 0)
  assert.equal(totalInterimBytes, 9000, 'total interim bytes must strictly equal sum of chunk lengths (linear bounded)')

  // 6. Send finish
  socket.emit('data', createWsFrame(JSON.stringify({ type: 'finish' })))
  await new Promise((r) => setTimeout(r, 100))

  assert.equal(transcribedChunks.length, 3, 'finish must trigger final transcribe')
  assert.equal(transcribedChunks[2].length, 9000, 'finish must process total audio (9000 bytes)')
  // Finish uses full chain (including cloud providers if configured)
  assert.equal(transcribedConfigs[2].chain.length, 3, 'finish uses complete configured chain')
})

test('Issue #293: interim skips cloud-only chains and offline local engines without burning quota', async () => {
  const { registerHostRoutes } = await import('../lib/host-routes.js')
  let upgradeHandler = null
  const mockCtx = {
    effect: (fn) => fn(),
    webServer: {
      register: () => () => {},
      registerUpgrade(opts) {
        if (opts.path === '/dsh-voice/ws/stream') upgradeHandler = opts.handler
        return () => {}
      },
    },
  }

  let transcribeCalls = 0

  const mockLiveConfig = {
    timeoutMs: 5000,
    dictation: {
      // Chain with only cloud providers and offline local engines
      chain: [
        { provider: 'deepgram', model: 'nova-2' },
        { provider: 'groq', model: 'whisper-large-v3' },
        { provider: 'local-whisper', model: 'base' },
      ],
      language: 'en',
    },
    message: { chain: [], language: 'en' },
  }

  registerHostRoutes(mockCtx, {
    live: () => mockLiveConfig,
    daemons: {
      whisperAlive: async () => false, // local-whisper is offline!
      sensevoiceAlive: async () => false,
      getWhisperError: () => null,
      getSensevoiceError: () => null,
      startWhisper: async () => {},
      startSensevoice: async () => {},
    },
    statsTracker: {},
    transcribe: async () => {
      transcribeCalls++
      return { text: 'should not be called' }
    },
    polishText: async () => '',
    sessionCommand: () => null,
    extractVoiceActions: () => ({}),
    applyJargonDictionary: (t) => t,
    KNOWN_KEYS: ['deepgram', 'groq', 'local-whisper'],
  })

  const token = getVoiceSessionToken()
  const socket = new EventEmitter()
  socket.writable = true
  socket.write = () => true
  socket.destroy = () => {}
  socket.remoteAddress = '127.0.0.1'

  const req = {
    url: `/dsh-voice/ws/stream?token=${token}`,
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      host: '127.0.0.1:3000',
      origin: 'http://127.0.0.1:3000',
      'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
      'sec-websocket-version': '13',
    },
  }

  upgradeHandler(req, socket, Buffer.alloc(0))

  socket.emit('data', createWsFrame(JSON.stringify({ type: 'init', mimeType: 'audio/webm', mode: 'dictation' })))
  socket.emit('data', createWsFrame(Buffer.alloc(4000, 1), 0x02))
  socket.emit('data', createWsFrame(JSON.stringify({ type: 'interim' })))

  await new Promise((r) => setTimeout(r, 100))

  // CRITICAL QUOTA SAFETY CHECK: when no local engine is alive, interim must make 0 transcribe calls!
  assert.equal(transcribeCalls, 0, 'interim must make ZERO transcribe calls when no local engine is available')
})
