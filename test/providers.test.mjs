import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeProviders, DEFAULT_MODELS, PROVIDER_KEYS } from '../lib/providers.js'

const bytes = new Uint8Array([1, 2, 3])

function depsWith(fetchImpl, key = 'secret') {
  return {
    resolveKey: async () => key,
    fetchImpl,
    cfg: {
      deepgramKeyEnv: 'DEEPGRAM_API_KEY',
      groqKeyEnv: 'GROQ_API_KEY',
      hfTokenEnv: 'HF_TOKEN',
      whisperUrl: 'http://127.0.0.1:8001/inference',
    },
  }
}

test('экспортирует все четыре ключа и модели по умолчанию', () => {
  assert.deepEqual(PROVIDER_KEYS, ['deepgram', 'groq', 'hf', 'local-whisper'])
  assert.equal(DEFAULT_MODELS.groq, 'whisper-large-v3-turbo')
})

test('deepgram подставляет выбранную модель в URL', async () => {
  let seenUrl = ''
  const fetchImpl = async (url) => {
    seenUrl = String(url)
    return { ok: true, json: async () => ({ results: { channels: [{ alternatives: [{ transcript: 'привет' }] }] } }) }
  }
  const providers = makeProviders(depsWith(fetchImpl), {
    bytes, mime: 'audio/webm', lang: 'ru', signal: undefined, models: { deepgram: 'nova-3' },
  })
  const out = await providers.deepgram()
  assert.equal(out.ok, true)
  assert.equal(out.text, 'привет')
  assert.match(seenUrl, /model=nova-3/)
})

test('groq кладёт выбранную модель в форму', async () => {
  let seenModel = ''
  const fetchImpl = async (_url, init) => {
    seenModel = init.body.get('model')
    return { ok: true, json: async () => ({ text: ' готово ' }) }
  }
  const providers = makeProviders(depsWith(fetchImpl), {
    bytes, mime: 'audio/webm', lang: 'ru', signal: undefined, models: { groq: 'whisper-large-v3' },
  })
  const out = await providers.groq()
  assert.equal(out.text, 'готово')
  assert.equal(seenModel, 'whisper-large-v3')
})

test('hf подставляет модель в путь URL', async () => {
  let seenUrl = ''
  const fetchImpl = async (url) => { seenUrl = String(url); return { ok: true, json: async () => ({ text: 'ок' }) } }
  const providers = makeProviders(depsWith(fetchImpl), {
    bytes, mime: 'audio/webm', lang: 'ru', signal: undefined, models: { hf: 'openai/whisper-small' },
  })
  await providers.hf()
  assert.match(seenUrl, /models\/openai\/whisper-small$/)
})

test('без ключа провайдер отказывает, а не бросает', async () => {
  const deps = depsWith(async () => { throw new Error('не должно вызываться') }, '')
  const providers = makeProviders(deps, { bytes, mime: 'audio/webm', lang: 'ru', signal: undefined, models: {} })
  const out = await providers.deepgram()
  assert.equal(out.ok, false)
  assert.match(out.reason, /DEEPGRAM_API_KEY/)
})

test('пустой транскрипт помечается как отказ', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ text: '   ' }) })
  const providers = makeProviders(depsWith(fetchImpl), {
    bytes, mime: 'audio/webm', lang: 'ru', signal: undefined, models: {},
  })
  const out = await providers.groq()
  assert.equal(out.ok, false)
  assert.equal(out.reason, 'empty transcript')
})

test('local-whisper читает ошибку из тела ответа, а не бросает', async () => {
  const fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({ error: 'failed to decode media' }) })
  const deps = depsWith(fetchImpl)
  deps.toWav = async () => new Uint8Array([9, 9, 9])
  const providers = makeProviders(deps, {
    bytes, mime: 'audio/webm', lang: 'ru', signal: undefined, models: {},
  })
  const out = await providers['local-whisper']()
  assert.equal(out.ok, false)
  assert.match(out.reason, /failed to decode media/)
})

// whisper.cpp принимает только WAV: на webm его сервер отвечает Invalid request.
test('local-whisper перегоняет не-WAV в WAV перед отправкой', async () => {
  let sentName = ''
  let sentType = ''
  const fetchImpl = async (_url, init) => {
    const f = init.body.get('file')
    sentName = f.name
    sentType = f.type
    return { ok: true, json: async () => ({ text: 'ок' }) }
  }
  const deps = depsWith(fetchImpl)
  let converted = false
  deps.toWav = async () => { converted = true; return new Uint8Array([1, 2, 3, 4]) }
  const providers = makeProviders(deps, {
    bytes, mime: 'audio/webm', lang: 'ru', signal: undefined, models: {},
  })
  const out = await providers['local-whisper']()
  assert.equal(out.ok, true)
  assert.equal(converted, true)
  assert.equal(sentName, 'audio.wav')
  assert.equal(sentType, 'audio/wav')
})

test('local-whisper не трогает WAV и не зовёт конвертер', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ text: 'ок' }) })
  const deps = depsWith(fetchImpl)
  deps.toWav = async () => { throw new Error('конвертер не должен вызываться для WAV') }
  const providers = makeProviders(deps, {
    bytes, mime: 'audio/wav', lang: 'ru', signal: undefined, models: {},
  })
  const out = await providers['local-whisper']()
  assert.equal(out.ok, true)
})

test('без конвертера не-WAV даёт понятный отказ, а не падение', async () => {
  const fetchImpl = async () => { throw new Error('не должно дойти до сети') }
  const providers = makeProviders(depsWith(fetchImpl), {
    bytes, mime: 'audio/webm', lang: 'ru', signal: undefined, models: {},
  })
  const out = await providers['local-whisper']()
  assert.equal(out.ok, false)
  assert.match(out.reason, /needs WAV/)
})
