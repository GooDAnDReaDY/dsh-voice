import test from 'node:test'
import assert from 'node:assert/strict'
import { readBody, writeJson, isLoopback, isTrustedCaller } from '../lib/http-util.js'
import { createPolishText } from '../lib/polish.js'
import { buildProviderOrder, sessionCommand } from '../lib/transcribe-core.js'
import { mockReq, mockRes, jsonBody } from './helpers/mock-http.mjs'

// ---------- readBody / writeJson / isTrustedCaller ----------

test('readBody resolves concatenated chunks', async () => {
  const req = mockReq('POST', 'hello')
  req.fire()
  const buf = await readBody(req, 1024)
  assert.equal(buf.toString('utf8'), 'hello')
})

test('readBody rejects oversized body with 413 error without premature stream destruction', async () => {
  const req = mockReq('POST', Buffer.alloc(64, 1))
  req.fire()
  await assert.rejects(
    () => readBody(req, 16),
    (err) => err.message === 'body too large' && err.statusCode === 413
  )
})

test('real HTTP server returns 413 JSON to client on oversized body without ECONNRESET (#207)', async () => {
  const http = await import('node:http')
  const server = http.createServer(async (req, res) => {
    try {
      await readBody(req, 32)
      writeJson(res, 200, { ok: true })
    } catch (e) {
      if (e.statusCode === 413 || e.message === 'body too large') {
        writeJson(res, 413, { ok: false, error: { code: 'too-large', message: 'payload too large' } })
        return
      }
      writeJson(res, 400, { ok: false, error: { code: 'bad', message: e.message } })
    }
  })

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port

  try {
    const res = await new Promise((resolve, reject) => {
      const clientReq = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': 128 }
      }, (clientRes) => {
        let data = ''
        clientRes.on('data', c => data += c)
        clientRes.on('end', () => resolve({ status: clientRes.statusCode, data: JSON.parse(data) }))
      })
      clientReq.on('error', reject)
      clientReq.write('X'.repeat(128))
      clientReq.end()
    })

    assert.equal(res.status, 413)
    assert.equal(res.data.ok, false)
    assert.equal(res.data.error.code, 'too-large')
  } finally {
    server.close()
  }
})

test('writeJson emits status, JSON body and no-store', () => {
  const res = mockRes()
  writeJson(res, 400, { ok: false, error: { code: 'empty', message: 'text required' } })
  assert.equal(res.statusCode, 400)
  assert.equal(res.headers['Content-Type'], 'application/json')
  assert.equal(res.headers['Cache-Control'], 'no-store')
  const body = jsonBody(res)
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'empty')
})

test('writeJson swallows closed-socket errors', () => {
  const res = {
    writeHead() { throw new Error('socket hang up') },
    end() { throw new Error('socket hang up') },
  }
  assert.doesNotThrow(() => writeJson(res, 200, { ok: true }))
})

test('isLoopback identifies 127.0.0.1, ::1, and ipv6-mapped ipv4', () => {
  assert.equal(isLoopback('127.0.0.1'), true)
  assert.equal(isLoopback('::1'), true)
  assert.equal(isLoopback('::ffff:127.0.0.1'), true)
  assert.equal(isLoopback('localhost'), true)
  assert.equal(isLoopback('192.168.1.50'), false)
  assert.equal(isLoopback('8.8.8.8'), false)
  assert.equal(isLoopback(''), false)
  assert.equal(isLoopback(null), false)
})

test('isTrustedCaller permits loopback and validated same-origin callers, rejects cross-origin', () => {
  // 1. Loopback remote address -> allowed
  assert.equal(isTrustedCaller({ socket: { remoteAddress: '127.0.0.1' }, headers: {} }), true)
  assert.equal(isTrustedCaller({ socket: { remoteAddress: '::1' }, headers: {} }), true)

  // 2. Same-origin via sec-fetch-site -> allowed
  assert.equal(isTrustedCaller({
    socket: { remoteAddress: '192.168.1.150' },
    headers: { 'sec-fetch-site': 'same-origin', host: 'example.com:3080' },
  }), true)
  // same-site is rejected without a validated origin (#117)
  assert.equal(isTrustedCaller({
    socket: { remoteAddress: '192.168.1.150' },
    headers: { 'sec-fetch-site': 'same-site', host: 'example.com:3080' },
  }), false)
  assert.equal(isTrustedCaller({
    socket: { remoteAddress: '192.168.1.150' },
    headers: { 'sec-fetch-site': 'same-site', origin: 'https://sub.example.com', host: 'example.com' },
  }), false)

  // 3. Matching origin -> allowed
  assert.equal(isTrustedCaller({
    socket: { remoteAddress: '10.0.0.2' },
    headers: { origin: 'http://dsh.local:3080', host: 'dsh.local:3080' },
  }), true)

  // 4. Matching referer -> allowed
  assert.equal(isTrustedCaller({
    socket: { remoteAddress: '10.0.0.2' },
    headers: { referer: 'http://dsh.local:3080/chat', host: 'dsh.local:3080' },
  }), true)

  // 5. Cross-site sec-fetch-site -> rejected
  assert.equal(isTrustedCaller({
    socket: { remoteAddress: '192.168.1.150' },
    headers: { 'sec-fetch-site': 'cross-site', host: 'example.com' },
  }), false)

  // 6. Mismatched origin -> rejected
  assert.equal(isTrustedCaller({
    socket: { remoteAddress: '192.168.1.150' },
    headers: { origin: 'https://evil-site.com', host: 'example.com' },
  }), false)

  // 7. Non-loopback request with no origin/sec-fetch headers -> rejected (fail-closed)
  assert.equal(isTrustedCaller({
    socket: { remoteAddress: '192.168.1.150' },
    headers: { host: 'example.com' },
  }), false)

  // 8. Cross-site or mismatched origin on loopback address must be rejected (#173)
  assert.equal(isTrustedCaller({
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'sec-fetch-site': 'cross-site', host: 'localhost:3080' },
  }), false, 'cross-site loopback request must be rejected')
  assert.equal(isTrustedCaller({
    socket: { remoteAddress: '127.0.0.1' },
    headers: { origin: 'https://evil.example', host: 'localhost:3080' },
  }), false, 'mismatched origin on loopback must be rejected')
  assert.equal(isTrustedCaller({
    socket: { remoteAddress: '127.0.0.1' },
    headers: { referer: 'https://evil.example/page', host: 'localhost:3080' },
  }), false, 'mismatched referer on loopback must be rejected')

  // 9. Mutation requests (POST/PUT/PATCH) require application/json or octet-stream (#173)
  assert.equal(isTrustedCaller({
    socket: { remoteAddress: '127.0.0.1' },
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
  }), false, 'POST with text/plain must be rejected')
  assert.equal(isTrustedCaller({
    socket: { remoteAddress: '127.0.0.1' },
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  }), false, 'POST with form data must be rejected')
  assert.equal(isTrustedCaller({
    socket: { remoteAddress: '127.0.0.1' },
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  }), true, 'POST with application/json on loopback is allowed')

  // 10. Null/undefined req -> false
  assert.equal(isTrustedCaller(null), false)
  assert.equal(isTrustedCaller({}), false)
})

// ---------- buildProviderOrder / localOnly ----------

const KNOWN = ['browser', 'deepgram', 'groq', 'hf', 'local-whisper', 'sensevoice', 'openai']
const MODELS = { groq: 'whisper-large-v3-turbo', deepgram: 'nova-2' }

test('buildProviderOrder keeps known providers and fills default models', () => {
  const { order, models } = buildProviderOrder({
    localOnly: false,
    chain: [
      { provider: 'deepgram', model: '' },
      { provider: 'custom-x', model: 'm1' },
      { provider: 'groq', model: 'nova-3' },
      { provider: 'unknown-nope', model: '' },
    ],
    customKeys: ['custom-x'],
    knownKeys: KNOWN,
    defaultModels: MODELS,
  })
  assert.deepEqual(order, ['deepgram', 'custom-x', 'groq'])
  assert.equal(models.deepgram, 'nova-2')
  assert.equal(models['custom-x'], 'm1')
  assert.equal(models.groq, 'nova-3')
})

test('localOnly filters chain to local-whisper', () => {
  const { order } = buildProviderOrder({
    localOnly: true,
    chain: [
      { provider: 'deepgram', model: '' },
      { provider: 'local-whisper', model: '' },
      { provider: 'groq', model: '' },
    ],
    customKeys: [],
    knownKeys: KNOWN,
    defaultModels: MODELS,
  })
  assert.deepEqual(order, ['local-whisper'])
})

test('localOnly without local-whisper in the chain throws a clear error', () => {
  assert.throws(
    () => buildProviderOrder({
      localOnly: true,
      chain: [{ provider: 'deepgram', model: '' }],
      customKeys: [],
      knownKeys: KNOWN,
      defaultModels: MODELS,
    }),
    /localOnly mode is on, but no local engine \(local-whisper or sensevoice\) is in the chain/,
  )
})

// ---------- sessionCommand ----------

test('sessionCommand matches send/cancel/stop/continue in ru, en and zh', () => {
  assert.equal(sessionCommand('send'), 'send')
  assert.equal(sessionCommand('Отправь!'), 'send')
  assert.equal(sessionCommand('发送'), 'send')
  assert.equal(sessionCommand('发出去!'), 'send')
  assert.equal(sessionCommand('отмена'), 'cancel')
  assert.equal(sessionCommand('Cancel'), 'cancel')
  assert.equal(sessionCommand('取消'), 'cancel')
  assert.equal(sessionCommand('算了'), 'cancel')
  assert.equal(sessionCommand('стоп'), 'stop')
  assert.equal(sessionCommand('STOP.'), 'stop')
  assert.equal(sessionCommand('停止'), 'stop')
  assert.equal(sessionCommand('暂停!'), 'stop')
  assert.equal(sessionCommand('продолжи'), 'continue')
  assert.equal(sessionCommand('  continue  '), 'continue')
  assert.equal(sessionCommand('继续'), 'continue')
  assert.equal(sessionCommand('hello world'), null)
  assert.equal(sessionCommand(''), null)
  assert.equal(sessionCommand(null), null)
})

// ---------- polishText ----------

function polishDeps(overrides = {}) {
  return {
    resolveKey: async () => 'sk-test',
    fetchImpl: async () => { throw new Error('fetch should not be called') },
    getConfig: () => ({ polishBaseUrl: '', polishModel: '', polishProvider: 'p', polishModelId: 'm' }),
    llm: null,
    createUserMessage: (payload) => payload,
    getAgentDefaultModel: () => null,
    ...overrides,
  }
}

test('polish is a no-op when polish/polishSend is off', async () => {
  const polish = createPolishText(polishDeps())
  assert.equal(await polish('raw text', { polish: false }, undefined), 'raw text')
  assert.equal(await polish('raw text', { polishSend: false }, undefined), 'raw text')
  assert.equal(await polish('', { polish: true }, undefined), '')
})

test('polish returns raw text when neither local endpoint nor LLM is available', async () => {
  const polish = createPolishText(polishDeps({
    getConfig: () => ({ polishBaseUrl: '' }),
    llm: null,
  }))
  assert.equal(await polish('сырой текст', { polish: true }, undefined), 'сырой текст')
})

test('polish returns raw text when harness LLM has no provider/model', async () => {
  const polish = createPolishText(polishDeps({
    getConfig: () => ({ polishBaseUrl: '', polishProvider: '', polishModelId: '' }),
    llm: { async *stream() { yield { type: 'text-delta', text: 'nope' } } },
    getAgentDefaultModel: () => null,
  }))
  assert.equal(await polish('keep me', { polish: true }, undefined), 'keep me')
})

test('polish uses local OpenAI-compatible endpoint and returns cleaned text', async () => {
  let seenUrl = ''
  let seenSignal = undefined
  const polish = createPolishText(polishDeps({
    getConfig: () => ({
      polishBaseUrl: 'http://127.0.0.1:11434/v1/',
      polishModel: 'llama3',
      polishKeyEnv: 'OLLAMA_KEY',
    }),
    fetchImpl: async (url, init) => {
      seenUrl = String(url)
      seenSignal = init.signal
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '  polished output  ' } }],
        }),
      }
    },
  }))
  const ctrl = new AbortController()
  const out = await polish('draft', { polish: true }, ctrl.signal)
  assert.equal(out, 'polished output')
  assert.equal(seenUrl, 'http://127.0.0.1:11434/v1/chat/completions')
  assert.equal(seenSignal, ctrl.signal)
})

test('polish returns raw text when local endpoint fails or aborts', async () => {
  const polishFail = createPolishText(polishDeps({
    getConfig: () => ({ polishBaseUrl: 'http://127.0.0.1:1' }),
    fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }),
  }))
  assert.equal(await polishFail('draft', { polish: true }, undefined), 'draft')

  const polishAbort = createPolishText(polishDeps({
    getConfig: () => ({ polishBaseUrl: 'http://127.0.0.1:1' }),
    fetchImpl: async (_url, init) => {
      throw new Error('This operation was aborted')
    },
  }))
  assert.equal(await polishAbort('draft', { polish: true }, undefined), 'draft')
})

test('polish LLM failure returns raw text (documented fallback)', async () => {
  const polish = createPolishText(polishDeps({
    getConfig: () => ({ polishBaseUrl: '', polishProvider: 'p', polishModelId: 'm' }),
    llm: {
      async *stream() {
        yield { type: 'text-delta', text: 'partial' }
        throw new Error('llm exploded')
      },
    },
    getAgentDefaultModel: () => null,
  }))
  assert.equal(await polish('draft', { polish: true }, undefined), 'draft')
})

test('polish harness LLM success returns cleaned streamed text', async () => {
  let seenArgs = null
  const polish = createPolishText(polishDeps({
    getConfig: () => ({ polishBaseUrl: '', polishProvider: 'prov', polishModelId: 'model-1' }),
    llm: {
      async *stream(args) {
        seenArgs = args
        yield { type: 'text-delta', text: 'pol' }
        yield { type: 'text-delta', text: 'ished' }
      },
    },
  }))
  const ctrl = new AbortController()
  const out = await polish('draft', { polish: true }, ctrl.signal)
  assert.equal(out, 'polished')
  assert.equal(seenArgs.provider, 'prov')
  assert.equal(seenArgs.model, 'model-1')
  assert.equal(seenArgs.signal, ctrl.signal)
})

test('polish empty LLM stream returns raw text', async () => {
  const polish = createPolishText(polishDeps({
    getConfig: () => ({ polishBaseUrl: '' }),
    llm: { async *stream() { /* yields nothing */ } },
    getAgentDefaultModel: () => ({ provider: 'p', model: 'm' }),
  }))
  assert.equal(await polish('draft', { polish: true }, undefined), 'draft')
})

// ---------- abort signal reaches provider fetchImpl ----------

test('groq provider forwards AbortSignal to fetchImpl', async () => {
  const { makeProviders } = await import('../lib/providers.js')
  let seenSignal = null
  const fetchImpl = async (_url, init) => {
    seenSignal = init && init.signal
    return { ok: true, json: async () => ({ text: 'ok' }) }
  }
  const providers = makeProviders(
    {
      resolveKey: async () => 'k',
      fetchImpl,
      cfg: { groqKeyEnv: 'GROQ_API_KEY' },
    },
    {
      bytes: new Uint8Array([1, 2, 3]),
      mime: 'audio/webm',
      lang: 'ru',
      signal: undefined,
      models: {},
    },
  )
  // rebuild with a real signal
  const ctrl = new AbortController()
  const providers2 = makeProviders(
    { resolveKey: async () => 'k', fetchImpl, cfg: { groqKeyEnv: 'GROQ_API_KEY' } },
    { bytes: new Uint8Array([1]), mime: 'audio/webm', lang: 'ru', signal: ctrl.signal, models: {} },
  )
  const out = await providers2.groq()
  assert.equal(out.ok, true)
  assert.equal(seenSignal, ctrl.signal)
})

test('timeout abort rejects hanging provider fetch', async () => {
  const { makeProviders } = await import('../lib/providers.js')
  const ctrl = new AbortController()
  const providers = makeProviders(
    {
      resolveKey: async () => 'k',
      fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          reject(new Error('This operation was aborted'))
        })
      }),
      cfg: { groqKeyEnv: 'GROQ_API_KEY' },
    },
    { bytes: new Uint8Array([1]), mime: 'audio/webm', lang: 'ru', signal: ctrl.signal, models: {} },
  )
  const t = setTimeout(() => ctrl.abort(), 20)
  const start = Date.now()
  await assert.rejects(() => providers.groq(), /aborted/i)
  clearTimeout(t)
  assert.ok(Date.now() - start < 2000, 'abort should not wait for a hung network')
})