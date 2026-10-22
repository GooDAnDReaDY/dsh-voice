// test/security-lan.test.mjs — Security tests for LAN bridge origin enforcement and token leak prevention (#292)
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hasSameOrigin,
  isTrustedCaller,
  getVoiceSessionToken,
  setVoiceSessionToken,
  rotateVoiceSessionToken,
  verifyVoiceSessionToken,
} from '../lib/http-util.js'
import { mockReq, mockRes, jsonBody } from './helpers/mock-http.mjs'

test('Issue #292: hasSameOrigin strictly validates Origin and Referer against Host', () => {
  // Matching origin
  assert.equal(hasSameOrigin({
    headers: { host: '192.168.1.111:3000', origin: 'http://192.168.1.111:3000' },
  }), true, 'matching origin must return true')

  // Matching referer
  assert.equal(hasSameOrigin({
    headers: { host: '192.168.1.111:3000', referer: 'http://192.168.1.111:3000/chat' },
  }), true, 'matching referer must return true')

  // Same-origin via sec-fetch-site
  assert.equal(hasSameOrigin({
    headers: { host: '192.168.1.111:3000', 'sec-fetch-site': 'same-origin' },
  }), true, 'sec-fetch-site same-origin must return true')

  // Mismatched origin
  assert.equal(hasSameOrigin({
    headers: { host: '192.168.1.111:3000', origin: 'http://evil.com' },
  }), false, 'mismatched origin must return false')

  // Mismatched referer
  assert.equal(hasSameOrigin({
    headers: { host: '192.168.1.111:3000', referer: 'http://evil.com/page' },
  }), false, 'mismatched referer must return false')

  // Cross-site sec-fetch-site rejects even with matching origin
  assert.equal(hasSameOrigin({
    headers: { host: '192.168.1.111:3000', origin: 'http://192.168.1.111:3000', 'sec-fetch-site': 'cross-site' },
  }), false, 'cross-site must be rejected')

  // Missing origin and referer and sec-fetch-site
  assert.equal(hasSameOrigin({
    headers: { host: '192.168.1.111:3000' },
  }), false, 'missing origin and referer must return false')

  // Null / invalid request
  assert.equal(hasSameOrigin(null), false)
  assert.equal(hasSameOrigin({}), false)
})

test('Issue #292: isTrustedCaller rejects mutating requests without Origin/Referer proxied via dsh-lanmode', () => {
  const lanHost = '192.168.1.111:3000'
  const loopbackSocket = { remoteAddress: '127.0.0.1' }

  // 1. Safe test request from PC: loopback socket, LAN host, NO origin, NO token -> REJECTED
  const lanBridgePost = {
    method: 'POST',
    socket: loopbackSocket,
    headers: {
      host: lanHost,
      'content-type': 'application/json',
    },
  }
  assert.equal(isTrustedCaller(lanBridgePost), false, 'POST without Origin from LAN bridge must be rejected')

  const lanBridgePut = {
    method: 'PUT',
    socket: loopbackSocket,
    headers: {
      host: lanHost,
      'content-type': 'application/json',
    },
  }
  assert.equal(isTrustedCaller(lanBridgePut), false, 'PUT without Origin from LAN bridge must be rejected')

  // 2. Request with valid x-dsh-voice-token -> ACCEPTED
  const token = getVoiceSessionToken()
  const lanBridgeWithToken = {
    method: 'POST',
    socket: loopbackSocket,
    headers: {
      host: lanHost,
      'content-type': 'application/json',
      'x-dsh-voice-token': token,
    },
  }
  assert.equal(isTrustedCaller(lanBridgeWithToken), true, 'POST with valid token from LAN bridge must be accepted')

  // 3. Request with valid same-origin -> ACCEPTED
  const lanBridgeWithOrigin = {
    method: 'POST',
    socket: loopbackSocket,
    headers: {
      host: lanHost,
      origin: `http://${lanHost}`,
      'content-type': 'application/json',
    },
  }
  assert.equal(isTrustedCaller(lanBridgeWithOrigin), true, 'POST with matching Origin from LAN bridge must be accepted')
})

test('Issue #292: GET /dsh-voice/status hides sessionToken when request has no same-origin', async () => {
  const { registerHostRoutes } = await import('../lib/host-routes.js')
  let statusHandler = null
  const mockCtx = {
    effect: (fn) => fn(),
    webServer: {
      register(opts) {
        if (opts.path === '/dsh-voice/status') statusHandler = opts.handler
        return () => {}
      },
    },
  }

  registerHostRoutes(mockCtx, {
    live: () => ({ hotkey: 'Alt', dictation: {}, message: {} }),
    daemons: {
      whisperAlive: async () => false,
      sensevoiceAlive: async () => false,
      getWhisperError: () => null,
      getSensevoiceError: () => null,
      startWhisper: async () => {},
      startSensevoice: async () => {},
    },
    statsTracker: { get: () => ({}) },
    transcribe: async () => {},
    polishText: async () => {},
    sessionCommand: () => null,
    extractVoiceActions: () => ({}),
    applyJargonDictionary: (t) => t,
    KNOWN_KEYS: [],
  })

  assert.ok(statusHandler, 'status route must be registered')

  // Case A: Request without Origin/Referer (safe curl from PC via dsh-lanmode)
  const reqNoOrigin = {
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { host: '192.168.1.111:3000' },
  }
  const resNoOrigin = mockRes()
  await statusHandler(reqNoOrigin, resNoOrigin)
  assert.equal(resNoOrigin.statusCode, 200)
  const bodyNoOrigin = jsonBody(resNoOrigin)
  assert.equal(bodyNoOrigin.ok, true)
  assert.equal(bodyNoOrigin.sessionToken, null, 'sessionToken must be null without same-origin')

  // Case B: Request with matching Origin (browser UI)
  const reqWithOrigin = {
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      host: '192.168.1.111:3000',
      origin: 'http://192.168.1.111:3000',
    },
  }
  const resWithOrigin = mockRes()
  await statusHandler(reqWithOrigin, resWithOrigin)
  assert.equal(resWithOrigin.statusCode, 200)
  const bodyWithOrigin = jsonBody(resWithOrigin)
  assert.equal(bodyWithOrigin.ok, true)
  assert.equal(typeof bodyWithOrigin.sessionToken, 'string', 'sessionToken must be string for same-origin')
  assert.equal(bodyWithOrigin.sessionToken.length, 48)
  assert.equal(verifyVoiceSessionToken(bodyWithOrigin.sessionToken), true)
})

test('Issue #292: PUT /dsh-voice/config rotates session token and invalidates previous token', async () => {
  const { registerConfigRoutes } = await import('../lib/config-routes.js')
  let configHandler = null
  const mockCtx = {
    webServer: {
      register(opts) {
        if (opts.path === '/dsh-voice/config') configHandler = opts.handler
        return () => {}
      },
    },
  }

  let storedConfig = { hotkey: 'Alt', dictation: {}, message: {} }
  const mockScope = {
    replace: async (cfg) => { storedConfig = cfg; return true },
  }

  registerConfigRoutes(mockCtx, {
    NS: 'dsh-voice',
    live: () => storedConfig,
    getSettingsService: () => null,
    getScope: () => mockScope,
    validateConfig: (c) => c,
    triggerAutostart: () => {},
  })

  assert.ok(configHandler, 'config route must be registered')

  const initialToken = getVoiceSessionToken()
  assert.ok(initialToken)

  // Mutate config via PUT
  const putReq = mockReq('PUT', JSON.stringify({ hotkey: 'Control' }), {
    host: '127.0.0.1:3000',
    origin: 'http://127.0.0.1:3000',
  })
  const putRes = mockRes()
  putReq.fire()
  await configHandler(putReq, putRes)
  await putRes.done

  assert.equal(putRes.statusCode, 200)
  const putBody = jsonBody(putRes)
  assert.equal(putBody.ok, true)
  assert.equal(typeof putBody.sessionToken, 'string')
  assert.notEqual(putBody.sessionToken, initialToken, 'session token must rotate upon config update')
  assert.equal(verifyVoiceSessionToken(initialToken), false, 'old token must no longer be valid')
  assert.equal(verifyVoiceSessionToken(putBody.sessionToken), true, 'new token must be valid')
})

test('Issue #292: /dsh-voice/ws/stream rejects upgrade without same-origin or valid token', async () => {
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

  registerHostRoutes(mockCtx, {
    live: () => ({ timeoutMs: 5000, dictation: {}, message: {} }),
    daemons: {
      whisperAlive: async () => false,
      sensevoiceAlive: async () => false,
      getWhisperError: () => null,
      getSensevoiceError: () => null,
      startWhisper: async () => {},
      startSensevoice: async () => {},
    },
    statsTracker: { get: () => ({}) },
    transcribe: async () => {},
    polishText: async () => {},
    sessionCommand: () => null,
    extractVoiceActions: () => ({}),
    applyJargonDictionary: (t) => t,
    KNOWN_KEYS: [],
  })

  assert.ok(upgradeHandler, 'ws/stream upgrade route must be registered')

  // 1. Upgrade from LAN bridge without Origin and without Token -> 403 Forbidden
  let written1 = ''
  let destroyed1 = false
  const socket1 = {
    write(d) { written1 += d },
    destroy() { destroyed1 = true },
    remoteAddress: '127.0.0.1',
  }
  const reqNoAuth = {
    url: '/dsh-voice/ws/stream',
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { host: '192.168.1.111:3000' },
  }
  upgradeHandler(reqNoAuth, socket1, Buffer.alloc(0))
  assert.ok(written1.includes('403 Forbidden'), 'upgrade without same-origin or token must return 403')
  assert.equal(destroyed1, true, 'socket must be destroyed')

  // 2. Upgrade with invalid token -> 401 or 403
  let written2 = ''
  let destroyed2 = false
  const socket2 = {
    write(d) { written2 += d },
    destroy() { destroyed2 = true },
    remoteAddress: '127.0.0.1',
  }
  const reqBadToken = {
    url: '/dsh-voice/ws/stream?token=invalid-secret-token',
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { host: '192.168.1.111:3000' },
  }
  upgradeHandler(reqBadToken, socket2, Buffer.alloc(0))
  assert.ok(written2.includes('403 Forbidden') || written2.includes('401 Unauthorized'), 'upgrade with bad token must fail')
  assert.equal(destroyed2, true, 'socket must be destroyed')
})
