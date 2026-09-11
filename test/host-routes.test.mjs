import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readBody, writeJson } from '../lib/http-util.js'
import { createPolishText } from '../lib/polish.js'
import { buildProviderOrder, sessionCommand } from '../lib/transcribe-core.js'
import { mockReq, mockRes, jsonBody } from './helpers/mock-http.mjs'

// ---------- readBody / writeJson ----------

test('readBody resolves concatenated chunks', async () => {
  const req = mockReq('POST', 'hello')
  req.fire()
  const buf = await readBody(req, 1024)
  assert.equal(buf.toString('utf8'), 'hello')
})

test('readBody rejects oversized body and destroys the stream', async () => {
  const req = mockReq('POST', Buffer.alloc(64, 1))
  req.fire()
  await assert.rejects(() => readBody(req, 16), /body too large/)
  assert.equal(req.destroyed, true)
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
    /localOnly mode is on, but local-whisper is not in the chain/,
  )
})

// ---------- sessionCommand ----------

test('sessionCommand matches send/cancel/stop/continue in ru and en', () => {
  assert.equal(sessionCommand('send'), 'send')
  assert.equal(sessionCommand('Отправь!'), 'send')
  assert.equal(sessionCommand('отмена'), 'cancel')
  assert.equal(sessionCommand('Cancel'), 'cancel')
  assert.equal(sessionCommand('стоп'), 'stop')
  assert.equal(sessionCommand('STOP.'), 'stop')
  assert.equal(sessionCommand('продолжи'), 'continue')
  assert.equal(sessionCommand('  continue  '), 'continue')
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
  // createUserMessage import will fail without peer deps installed; either
  // path must still yield the raw text.
  assert.equal(await polish('draft', { polish: true }, undefined), 'draft')
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