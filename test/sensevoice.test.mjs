import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeProviders } from '../lib/providers.js'

const bytes = new Uint8Array([1, 2, 3])

function depsWith(fetchImpl, extra = {}) {
  return {
    resolveKey: async () => 'secret',
    fetchImpl,
    cfg: {
      sensevoiceUrl: 'http://127.0.0.1:6006/api/v1/asr',
      ...extra.cfg,
    },
    ...extra,
  }
}

test('sensevoice отправляет WAV на sherpa-onnx endpoint и возвращает чистый текст', async () => {
  let seenUrl = ''
  let seenBody = null
  const fetchImpl = async (url, init) => {
    seenUrl = String(url)
    seenBody = init.body
    return {
      ok: true,
      json: async () => ({ text: 'Привет мир' }),
    }
  }

  const providers = makeProviders(depsWith(fetchImpl), {
    bytes,
    mime: 'audio/wav',
    lang: 'ru',
    signal: undefined,
    models: {},
  })

  const out = await providers.sensevoice()
  assert.equal(out.ok, true)
  assert.equal(out.provider, 'sensevoice')
  assert.equal(out.text, 'Привет мир')
  assert.equal(seenUrl, 'http://127.0.0.1:6006/api/v1/asr')
  assert.ok(seenBody.has('file'))
})

test('sensevoice очищает токены эмоций и звуковых событий SenseVoice', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ text: '<|zh|><|NEUTRAL|><|Speech|><|withitn|>Тестовая фраза<|HAPPY|>' }),
  })

  const providers = makeProviders(depsWith(fetchImpl), {
    bytes,
    mime: 'audio/wav',
    lang: 'auto',
    signal: undefined,
    models: {},
  })

  const out = await providers.sensevoice()
  assert.equal(out.ok, true)
  assert.equal(out.text, 'Тестовая фраза')
})

test('sensevoice перегоняет не-WAV в WAV через toWav', async () => {
  let toWavCalled = false
  const deps = depsWith(
    async () => ({ ok: true, json: async () => ({ text: 'конвертировано' }) }),
    {
      toWav: async (input) => {
        toWavCalled = true
        return input
      },
    }
  )

  const providers = makeProviders(deps, {
    bytes,
    mime: 'audio/webm',
    lang: 'en',
    signal: undefined,
    models: {},
  })

  const out = await providers.sensevoice()
  assert.equal(out.ok, true)
  assert.equal(toWavCalled, true)
  assert.equal(out.text, 'конвертировано')
})

test('sensevoice поддерживает OpenAI-совместимый эндпоинт', async () => {
  let seenModel = ''
  const fetchImpl = async (url, init) => {
    seenModel = init.body.get('model')
    return {
      ok: true,
      json: async () => ({ text: 'openai format' }),
    }
  }

  const providers = makeProviders(
    depsWith(fetchImpl, { cfg: { sensevoiceUrl: 'http://127.0.0.1:8000/v1/audio/transcriptions' } }),
    {
      bytes,
      mime: 'audio/wav',
      lang: 'en',
      signal: undefined,
      models: { sensevoice: 'SenseVoiceSmall' },
    }
  )

  const out = await providers.sensevoice()
  assert.equal(out.ok, true)
  assert.equal(seenModel, 'SenseVoiceSmall')
  assert.equal(out.text, 'openai format')
})

test('sensevoice возвращает понятный отказ при HTTP ошибке', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 503,
    json: async () => ({ error: 'model busy' }),
  })

  const providers = makeProviders(depsWith(fetchImpl), {
    bytes,
    mime: 'audio/wav',
    lang: 'en',
    signal: undefined,
    models: {},
  })

  const out = await providers.sensevoice()
  assert.equal(out.ok, false)
  assert.equal(out.provider, 'sensevoice')
  assert.match(out.reason, /model busy/)
})
