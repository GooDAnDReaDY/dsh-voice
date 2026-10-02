import test from 'node:test'
import assert from 'node:assert/strict'
import { registerConfigRoutes } from '../lib/config-routes.js'
import { mockReq, mockRes, jsonBody } from './helpers/mock-http.mjs'

function createFakeCtx() {
  let registeredRoute = null
  const ctx = {
    webServer: {
      register: (route) => {
        registeredRoute = route
        return () => {}
      },
    },
  }
  return { ctx, getRoute: () => registeredRoute }
}

test('registerConfigRoutes mounts /dsh-voice/config with exact kind', () => {
  const { ctx, getRoute } = createFakeCtx()
  registerConfigRoutes(ctx, {
    NS: 'dsh-voice',
    live: () => ({ hotkey: 'Control' }),
    getSettingsService: () => ({}),
    getScope: () => null,
    validateConfig: (c) => c,
    triggerAutostart: () => {},
  })

  const route = getRoute()
  assert.ok(route, 'Route must be registered')
  assert.equal(route.path, '/dsh-voice/config')
  assert.equal(route.kind, 'exact')
})

test('GET /dsh-voice/config returns 200 with current live config for trusted callers', async () => {
  const { ctx, getRoute } = createFakeCtx()
  const liveCfg = { hotkey: 'Alt', dictation: { language: 'ru' } }
  registerConfigRoutes(ctx, {
    NS: 'dsh-voice',
    live: () => liveCfg,
    getSettingsService: () => null,
    getScope: () => null,
    validateConfig: (c) => c,
    triggerAutostart: () => {},
  })

  const route = getRoute()
  const req = mockReq('GET', '')
  req.socket = { remoteAddress: '127.0.0.1' }
  const res = mockRes()
  await route.handler(req, res)

  assert.equal(res.statusCode, 200)
  const body = jsonBody(res)
  assert.equal(body.ok, true)
  assert.deepEqual(body.config, liveCfg)
})

test('disallowed HTTP methods return 405 Method Not Allowed', async () => {
  const { ctx, getRoute } = createFakeCtx()
  registerConfigRoutes(ctx, {
    NS: 'dsh-voice',
    live: () => ({}),
    getSettingsService: () => ({}),
    getScope: () => null,
    validateConfig: (c) => c,
    triggerAutostart: () => {},
  })

  const route = getRoute()
  for (const method of ['DELETE', 'PATCH', 'HEAD', 'OPTIONS']) {
    const req = mockReq(method, '')
    req.socket = { remoteAddress: '127.0.0.1' }
    const res = mockRes()
    await route.handler(req, res)
    assert.equal(res.statusCode, 405, `Method ${method} should return 405`)
    const body = jsonBody(res)
    assert.equal(body.ok, false)
    assert.equal(body.error.code, 'method')
  }
})

test('untrusted callers return 403 Forbidden', async () => {
  const { ctx, getRoute } = createFakeCtx()
  registerConfigRoutes(ctx, {
    NS: 'dsh-voice',
    live: () => ({}),
    getSettingsService: () => ({}),
    getScope: () => null,
    validateConfig: (c) => c,
    triggerAutostart: () => {},
  })

  const route = getRoute()
  // Remote IP, cross-site header
  const req = mockReq('GET', '')
  req.socket = { remoteAddress: '192.168.1.50' }
  req.headers = { 'sec-fetch-site': 'cross-site' }
  const res = mockRes()
  await route.handler(req, res)

  assert.equal(res.statusCode, 403)
  const body = jsonBody(res)
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'forbidden')
})

test('PUT /dsh-voice/config returns 503 when settings service and scope are missing', async () => {
  const { ctx, getRoute } = createFakeCtx()
  registerConfigRoutes(ctx, {
    NS: 'dsh-voice',
    live: () => ({}),
    getSettingsService: () => null,
    getScope: () => null,
    validateConfig: (c) => c,
    triggerAutostart: () => {},
  })

  const route = getRoute()
  const req = mockReq('PUT', JSON.stringify({ hotkey: 'Alt' }))
  req.socket = { remoteAddress: '127.0.0.1' }
  req.fire()
  const res = mockRes()
  await route.handler(req, res)

  assert.equal(res.statusCode, 503)
  const body = jsonBody(res)
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'unavailable')
})

test('PUT /dsh-voice/config returns 400 for invalid JSON or invalid payload', async () => {
  const { ctx, getRoute } = createFakeCtx()
  registerConfigRoutes(ctx, {
    NS: 'dsh-voice',
    live: () => ({}),
    getSettingsService: () => ({ replace: async () => {} }),
    getScope: () => null,
    validateConfig: (c) => {
      if (c.invalid) throw new Error('invalid field')
      return c
    },
    triggerAutostart: () => {},
  })

  const route = getRoute()

  // 1. Corrupt JSON
  {
    const req = mockReq('PUT', '{ bad json ...')
    req.socket = { remoteAddress: '127.0.0.1' }
    req.fire()
    const res = mockRes()
    await route.handler(req, res)
    assert.equal(res.statusCode, 400)
    assert.equal(jsonBody(res).error.code, 'json')
  }

  // 2. Validation failure
  {
    const req = mockReq('PUT', JSON.stringify({ invalid: true }))
    req.socket = { remoteAddress: '127.0.0.1' }
    req.fire()
    const res = mockRes()
    await route.handler(req, res)
    assert.equal(res.statusCode, 400)
    assert.equal(jsonBody(res).error.code, 'validation')
  }
})

test('PUT /dsh-voice/config persists via settingsService.replace and triggers autostart', async () => {
  const { ctx, getRoute } = createFakeCtx()
  let liveCfg = { hotkey: 'Control', dictation: { language: 'ru' } }
  let replacedNs = null
  let replacedPayload = null
  let replacedRev = null
  let autostartTriggered = false

  const mockSettings = {
    describe: () => [{ ns: 'dsh-voice', revision: 42 }],
    replace: async (ns, payload, rev) => {
      replacedNs = ns
      replacedPayload = payload
      replacedRev = rev
      liveCfg = { ...liveCfg, ...payload }
    },
  }

  registerConfigRoutes(ctx, {
    NS: 'dsh-voice',
    live: () => liveCfg,
    getSettingsService: () => mockSettings,
    getScope: () => null,
    validateConfig: (c) => c,
    triggerAutostart: () => { autostartTriggered = true },
  })

  const route = getRoute()
  const req = mockReq('PUT', JSON.stringify({ config: { hotkey: 'KeyV' } }))
  req.socket = { remoteAddress: '127.0.0.1' }
  req.fire()
  const res = mockRes()
  await route.handler(req, res)

  assert.equal(res.statusCode, 200)
  assert.equal(replacedNs, 'dsh-voice')
  assert.equal(replacedRev, 42)
  assert.equal(replacedPayload.hotkey, 'KeyV')
  assert.equal(autostartTriggered, true)
  const body = jsonBody(res)
  assert.equal(body.ok, true)
  assert.equal(body.config.hotkey, 'KeyV')
})

test('PUT /dsh-voice/config falls back to settingsService.update when replace is not a function', async () => {
  const { ctx, getRoute } = createFakeCtx()
  let liveCfg = { hotkey: 'Control' }
  let updatedNs = null
  let updatedPayload = null

  const mockSettings = {
    describe: () => [{ ns: 'dsh-voice', revision: 10 }],
    update: async (ns, payload) => {
      updatedNs = ns
      updatedPayload = payload
      liveCfg = { ...liveCfg, ...payload }
    },
  }

  registerConfigRoutes(ctx, {
    NS: 'dsh-voice',
    live: () => liveCfg,
    getSettingsService: () => mockSettings,
    getScope: () => null,
    validateConfig: (c) => c,
    triggerAutostart: () => {},
  })

  const route = getRoute()
  const req = mockReq('PUT', JSON.stringify({ hotkey: 'Shift' }))
  req.socket = { remoteAddress: '127.0.0.1' }
  req.fire()
  const res = mockRes()
  await route.handler(req, res)

  assert.equal(res.statusCode, 200)
  assert.equal(updatedNs, 'dsh-voice')
  assert.equal(updatedPayload.hotkey, 'Shift')
})

test('PUT /dsh-voice/config falls back to scope when settingsService is absent', async () => {
  const { ctx, getRoute } = createFakeCtx()
  let liveCfg = { hotkey: 'Control' }
  let scopeReplaced = null

  const mockScope = {
    replace: async (val) => {
      scopeReplaced = val
      liveCfg = { ...liveCfg, ...val }
    },
  }

  registerConfigRoutes(ctx, {
    NS: 'dsh-voice',
    live: () => liveCfg,
    getSettingsService: () => null,
    getScope: () => mockScope,
    validateConfig: (c) => c,
    triggerAutostart: () => {},
  })

  const route = getRoute()
  const req = mockReq('PUT', JSON.stringify({ hotkey: 'Alt' }))
  req.socket = { remoteAddress: '127.0.0.1' }
  req.fire()
  const res = mockRes()
  await route.handler(req, res)

  assert.equal(res.statusCode, 200)
  assert.equal(scopeReplaced.hotkey, 'Alt')
})

test('POST /dsh-voice/config also accepted as alias for PUT', async () => {
  const { ctx, getRoute } = createFakeCtx()
  let liveCfg = { hotkey: 'Control' }

  const mockScope = {
    replace: async (val) => { liveCfg = { ...liveCfg, ...val } },
  }

  registerConfigRoutes(ctx, {
    NS: 'dsh-voice',
    live: () => liveCfg,
    getSettingsService: () => null,
    getScope: () => mockScope,
    validateConfig: (c) => c,
    triggerAutostart: () => {},
  })

  const route = getRoute()
  const req = mockReq('POST', JSON.stringify({ hotkey: 'KeyZ' }))
  req.socket = { remoteAddress: '127.0.0.1' }
  req.fire()
  const res = mockRes()
  await route.handler(req, res)

  assert.equal(res.statusCode, 200)
  assert.equal(liveCfg.hotkey, 'KeyZ')
})
test('PUT /dsh-voice/config fails when legacy scope.set throws/rejects (#204)', async () => {
  const { ctx, getRoute } = createFakeCtx()
  const mockScope = {
    set: async () => {
      throw new Error('disk full or permission denied')
    },
  }

  registerConfigRoutes(ctx, {
    NS: 'dsh-voice',
    live: () => ({ hotkey: 'Control' }),
    getSettingsService: () => null,
    getScope: () => mockScope,
    validateConfig: (c) => c,
    triggerAutostart: () => {},
  })

  const route = getRoute()
  const req = mockReq('PUT', JSON.stringify({ hotkey: 'F8' }))
  req.socket = { remoteAddress: '127.0.0.1' }
  req.fire()
  const res = mockRes()
  await route.handler(req, res)

  assert.equal(res.statusCode, 500)
  const body = jsonBody(res)
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'save')
  assert.match(body.error.message, /disk full or permission denied/)
})

test('PUT /dsh-voice/config does not write to legacy scope if settingsService succeeded (#204)', async () => {
  const { ctx, getRoute } = createFakeCtx()
  let scopeCalled = false
  const mockSettings = {
    replace: async () => {},
  }
  const mockScope = {
    replace: async () => { scopeCalled = true },
    set: async () => { scopeCalled = true },
  }

  registerConfigRoutes(ctx, {
    NS: 'dsh-voice',
    live: () => ({ hotkey: 'Control' }),
    getSettingsService: () => mockSettings,
    getScope: () => mockScope,
    validateConfig: (c) => c,
    triggerAutostart: () => {},
  })

  const route = getRoute()
  const req = mockReq('PUT', JSON.stringify({ hotkey: 'F8' }))
  req.socket = { remoteAddress: '127.0.0.1' }
  req.fire()
  const res = mockRes()
  await route.handler(req, res)

  assert.equal(res.statusCode, 200)
  assert.equal(scopeCalled, false, 'scope must not be called when settingsService succeeded')
})

test('GET /dsh-voice/config includes revision when available (#215)', async () => {
  const { ctx, getRoute } = createFakeCtx()
  const mockSettings = {
    describe: () => [{ ns: 'dsh-voice', revision: 7 }],
  }
  registerConfigRoutes(ctx, {
    NS: 'dsh-voice',
    live: () => ({ hotkey: 'Control' }),
    getSettingsService: () => mockSettings,
    getScope: () => null,
    validateConfig: (c) => c,
    triggerAutostart: () => {},
  })

  const route = getRoute()
  const req = mockReq('GET', '')
  req.socket = { remoteAddress: '127.0.0.1' }
  const res = mockRes()
  await route.handler(req, res)

  assert.equal(res.statusCode, 200)
  const body = jsonBody(res)
  assert.equal(body.ok, true)
  assert.equal(body.revision, 7)
})

test('PUT /dsh-voice/config returns 409 Conflict when expectedRevision does not match currentRevision (#215)', async () => {
  const { ctx, getRoute } = createFakeCtx()
  let savedCalled = false
  const mockSettings = {
    describe: () => [{ ns: 'dsh-voice', revision: 5 }],
    replace: async () => { savedCalled = true },
  }
  registerConfigRoutes(ctx, {
    NS: 'dsh-voice',
    live: () => ({ hotkey: 'Control' }),
    getSettingsService: () => mockSettings,
    getScope: () => null,
    validateConfig: (c) => c,
    triggerAutostart: () => {},
  })

  const route = getRoute()
  const req = mockReq('PUT', JSON.stringify({ config: { hotkey: 'F8' }, expectedRevision: 4 }))
  req.socket = { remoteAddress: '127.0.0.1' }
  req.fire()
  const res = mockRes()
  await route.handler(req, res)

  assert.equal(res.statusCode, 409)
  const body = jsonBody(res)
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'conflict')
  assert.equal(body.error.currentRevision, 5)
  assert.equal(savedCalled, false, 'must not persist when revision conflicts')
})
