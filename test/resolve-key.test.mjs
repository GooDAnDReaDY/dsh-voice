// Regression test for resolveKey: every keyEnv provider reported "no <ENV>"
// because the guard tested ref.type on a plain string, and the credential
// object was returned instead of its .value.
import assert from 'node:assert/strict'
import test from 'node:test'
import { apply } from '../lib/index.js'
import { BaseConfig } from '../lib/schema.js'
import { mockReq, mockRes, jsonBody } from './helpers/mock-http.mjs'

// Mirror of the fixed helper: `credentials.resolve()` answers { value, source }.
function makeResolveKey(credentials) {
  const credentialRef = (v) => {
    if (typeof v !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(v)) throw new TypeError('bad ref')
    return v
  }
  return async (ref) => {
    if (!ref || typeof ref !== 'string') return ''
    try {
      const resolved = await credentials.resolve(credentialRef(ref))
      return (typeof resolved === 'string' ? resolved : resolved?.value) || ''
    } catch {
      return ''
    }
  }
}

const credentials = {
  resolve: async (ref) => (ref === 'DEEPGRAM_API_KEY' ? { value: 'sk-live-123', source: 'env' } : undefined),
}

test('resolves a plain string reference to its secret', async () => {
  assert.equal(await makeResolveKey(credentials)('DEEPGRAM_API_KEY'), 'sk-live-123')
})

test('returns an empty string for an unknown reference', async () => {
  assert.equal(await makeResolveKey(credentials)('MISSING_KEY'), '')
})

test('returns an empty string for a missing or non-string reference', async () => {
  assert.equal(await makeResolveKey(credentials)(undefined), '')
  assert.equal(await makeResolveKey(credentials)(''), '')
  assert.equal(await makeResolveKey(credentials)({ type: 'env' }), '')
})

test('supports plain string credential resolution for backwards compatibility', async () => {
  const stringCreds = {
    resolve: async (ref) => (ref === 'CUSTOM_KEY' ? 'plain-secret-value' : undefined),
  }
  assert.equal(await makeResolveKey(stringCreds)('CUSTOM_KEY'), 'plain-secret-value')
})

test('a string has no .type, which is why the old guard always short-circuited', () => {
  assert.equal(('DEEPGRAM_API_KEY').type, undefined)
})

test('integration: apply() wires resolveKey to extract secret into transcribe requests', async () => {
  let capturedHeaders = null
  const mockFetch = async (url, opts) => {
    capturedHeaders = opts?.headers || {}
    return {
      ok: true,
      status: 200,
      json: async () => ({
        results: { channels: [{ alternatives: [{ transcript: 'transcription success' }] }] },
      }),
    }
  }

  const routes = {}
  const mockCtx = {
    effect: (fn) => fn(),
    inject: (deps, fn) => {
      if (deps.includes('settings')) {
        fn({
          settings: {
            register: () => ({ get: () => null, watch: () => {} }),
            describe: () => [],
          },
          effect: (f) => f(),
        })
      }
    },
    webServer: {
      register: (def) => {
        routes[def.path] = def.handler
        return () => { delete routes[def.path] }
      },
      registerRoute: (path, handler) => { routes[path] = handler },
      registerUpgrade: () => {},
    },
    tools: { register: () => () => {} },
    credentials: {
      resolve: async (ref) => (ref === 'DEEPGRAM_API_KEY' ? { value: 'test-dg-secret', source: 'env' } : null),
    },
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    on: () => {},
    shell: { resolve: () => ({ command: '' }), execute: () => ({}) },
  }

  // Override global fetch inside test
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockFetch

  try {
    const cfg = BaseConfig({
      dictation: { chain: [{ provider: 'deepgram' }], language: 'en' },
    })
    apply(mockCtx, cfg)

    assert.ok(routes['/dsh-voice/transcribe'], 'transcribe route must be registered')
    const req = mockReq('POST', JSON.stringify({
      dataBase64: Buffer.from('RIFF mock wav data 1234567890').toString('base64'),
      mimeType: 'audio/wav',
      mode: 'dictation',
    }))
    const res = mockRes()
    const promise = routes['/dsh-voice/transcribe'](req, res)
    req.fire()
    await promise

    const resBody = jsonBody(res)
    assert.ok(capturedHeaders, 'fetch must have been called: ' + JSON.stringify(resBody))
    const authHeader = capturedHeaders.authorization || capturedHeaders.Authorization
    assert.equal(authHeader, 'Token test-dg-secret', 'authorization header must carry unwrapped secret')
    assert.equal(resBody?.ok, true)
    assert.equal(resBody?.text, 'transcription success')
  } finally {
    globalThis.fetch = originalFetch
  }
})
