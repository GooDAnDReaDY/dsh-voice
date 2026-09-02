import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeProviders, DEFAULT_MODELS, PROVIDER_KEYS, PRESET_PROVIDERS, PRESET_KEYS, KNOWN_KEYS, CUSTOM_TEMPLATES } from '../lib/providers.js'

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

test('экспортирует все встроенные ключи и модели по умолчанию', () => {
  assert.deepEqual(PROVIDER_KEYS, ['browser', 'deepgram', 'groq', 'hf', 'local-whisper', 'sensevoice'])
  assert.equal(DEFAULT_MODELS.groq, 'whisper-large-v3-turbo')
  assert.equal(DEFAULT_MODELS.sensevoice, 'SenseVoiceSmall')
})

test('browser на хосте не выполняется, а вежливо уступает следующему', async () => {
  const providers = makeProviders(depsWith(async () => { throw new Error('сеть трогать не должны') }), {
    bytes, mime: 'audio/webm', lang: 'ru', signal: undefined, models: {},
  })
  const out = await providers.browser()
  assert.equal(out.ok, false)
  assert.equal(out.provider, 'browser')
  assert.match(out.reason, /в браузере/)
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

// --------------------------------------------------------- свои провайдеры

// Своего провайдера собираем тем же makeProviders: он попадает в карту по
// своему имени и дальше ничем не отличается от встроенного.
function customDeps(fetchImpl, spec, extra = {}) {
  return {
    resolveKey: async () => extra.key !== undefined ? extra.key : 'secret',
    fetchImpl,
    toWav: extra.toWav,
    cfg: {
      deepgramKeyEnv: 'DEEPGRAM_API_KEY',
      groqKeyEnv: 'GROQ_API_KEY',
      hfTokenEnv: 'HF_TOKEN',
      whisperUrl: 'http://127.0.0.1:8001/inference',
      customProviders: [spec],
    },
  }
}

const OR = {
  key: 'openrouter',
  template: 'openai-chat-audio',
  baseURL: 'https://openrouter.ai/api/v1',
  model: 'google/gemini-2.5-flash',
  keyEnv: 'OPENROUTER_KEY',
  prompt: '',
}

test('экспортирует оба шаблона своих провайдеров', () => {
  assert.deepEqual(CUSTOM_TEMPLATES, ['openai-transcriptions', 'openai-chat-audio'])
})

test('свой провайдер попадает в карту под своим именем', () => {
  const providers = makeProviders(customDeps(async () => ({}), OR), {
    bytes, mime: 'audio/wav', lang: 'ru', signal: undefined, models: {},
  })
  assert.equal(typeof providers.openrouter, 'function')
  assert.deepEqual(Object.keys(providers).slice(0, PROVIDER_KEYS.length), PROVIDER_KEYS)
})

test('шаблон transcriptions шлёт multipart на {baseURL}/audio/transcriptions', async () => {
  let seen = {}
  const fetchImpl = async (url, init) => {
    seen = { url: String(url), model: init.body.get('model'), lang: init.body.get('language'), auth: init.headers.authorization }
    return { ok: true, json: async () => ({ text: ' свой текст ' }) }
  }
  const spec = { key: 'mystt', template: 'openai-transcriptions', baseURL: 'https://api.example.com/v1/', model: 'whisper-1', keyEnv: 'MY_KEY' }
  const providers = makeProviders(customDeps(fetchImpl, spec), {
    bytes, mime: 'audio/webm', lang: 'ru', signal: undefined, models: {},
  })
  const out = await providers.mystt()
  assert.equal(out.ok, true)
  assert.equal(out.text, 'свой текст')
  assert.equal(out.provider, 'mystt')
  // Хвостовой слэш в baseURL не должен давать двойной // в пути.
  assert.equal(seen.url, 'https://api.example.com/v1/audio/transcriptions')
  assert.equal(seen.model, 'whisper-1')
  assert.equal(seen.lang, 'ru')
  assert.equal(seen.auth, 'Bearer secret')
})

test('шаблон chat-audio кладёт аудио в input_audio и читает ответ чата', async () => {
  let body = null
  const fetchImpl = async (url, init) => {
    assert.equal(String(url), 'https://openrouter.ai/api/v1/chat/completions')
    body = JSON.parse(init.body)
    return { ok: true, json: async () => ({ choices: [{ message: { content: ' распознано ' } }] }) }
  }
  const providers = makeProviders(customDeps(fetchImpl, OR), {
    bytes, mime: 'audio/wav', lang: 'ru', signal: undefined, models: {},
  })
  const out = await providers.openrouter()
  assert.equal(out.text, 'распознано')
  assert.equal(body.model, 'google/gemini-2.5-flash')
  const parts = body.messages[0].content
  assert.equal(parts[1].type, 'input_audio')
  assert.equal(parts[1].input_audio.format, 'wav')
  assert.equal(parts[1].input_audio.data, Buffer.from(bytes).toString('base64'))
  // Язык подсказывается в тексте: отдельного поля у этого шаблона нет.
  assert.match(parts[0].text, /language is ru/)
})

test('chat-audio перегоняет webm в WAV, потому что такого формата API не берёт', async () => {
  let converted = false
  const wav = new Uint8Array([9, 9, 9])
  const fetchImpl = async (_url, init) => {
    const parts = JSON.parse(init.body).messages[0].content
    assert.equal(parts[1].input_audio.format, 'wav')
    assert.equal(parts[1].input_audio.data, Buffer.from(wav).toString('base64'))
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'ок' } }] }) }
  }
  const deps = customDeps(fetchImpl, OR, { toWav: async () => { converted = true; return wav } })
  const providers = makeProviders(deps, { bytes, mime: 'audio/webm', lang: 'ru', signal: undefined, models: {} })
  const out = await providers.openrouter()
  assert.equal(out.ok, true)
  assert.equal(converted, true)
})

test('chat-audio не трогает mp3 и не зовёт конвертер', async () => {
  let converted = false
  const fetchImpl = async (_url, init) => {
    assert.equal(JSON.parse(init.body).messages[0].content[1].input_audio.format, 'mp3')
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'ок' } }] }) }
  }
  const deps = customDeps(fetchImpl, OR, { toWav: async () => { converted = true; return bytes } })
  const providers = makeProviders(deps, { bytes, mime: 'audio/mpeg', lang: 'auto', signal: undefined, models: {} })
  await providers.openrouter()
  assert.equal(converted, false)
})

test('модель из цепочки перекрывает модель провайдера', async () => {
  let seenModel = ''
  const fetchImpl = async (_url, init) => {
    seenModel = JSON.parse(init.body).model
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'ок' } }] }) }
  }
  const providers = makeProviders(customDeps(fetchImpl, OR), {
    bytes, mime: 'audio/wav', lang: 'ru', signal: undefined, models: { openrouter: 'openai/gpt-4o-audio-preview' },
  })
  await providers.openrouter()
  assert.equal(seenModel, 'openai/gpt-4o-audio-preview')
})

test('свой провайдер не может перекрыть встроенного', () => {
  const spec = { key: 'groq', template: 'openai-transcriptions', baseURL: 'https://evil.example', model: 'x' }
  const providers = makeProviders(customDeps(async () => ({}), spec), {
    bytes, mime: 'audio/wav', lang: 'ru', signal: undefined, models: {},
  })
  assert.equal(providers.groq.name, 'groq')
})

test('неполное описание своего провайдера даёт отказ, а не падение', async () => {
  const cases = [
    [{ key: 'a', template: 'openai-transcriptions', baseURL: '', model: 'm' }, /no baseURL/],
    [{ key: 'a', template: 'openai-transcriptions', baseURL: 'https://x', model: '' }, /no model/],
  ]
  for (const [spec, expected] of cases) {
    const providers = makeProviders(customDeps(async () => ({}), spec), {
      bytes, mime: 'audio/wav', lang: 'ru', signal: undefined, models: {},
    })
    const out = await providers.a()
    assert.equal(out.ok, false)
    assert.match(out.reason, expected)
  }
})

test('без ключа свой провайдер отказывает с именем ключа', async () => {
  const providers = makeProviders(customDeps(async () => ({}), OR, { key: '' }), {
    bytes, mime: 'audio/wav', lang: 'ru', signal: undefined, models: {},
  })
  const out = await providers.openrouter()
  assert.equal(out.ok, false)
  assert.equal(out.reason, 'no OPENROUTER_KEY')
})

test('ошибка HTTP у своего провайдера становится отказом цепочки', async () => {
  const fetchImpl = async () => ({ ok: false, status: 429 })
  const providers = makeProviders(customDeps(fetchImpl, OR), {
    bytes, mime: 'audio/wav', lang: 'ru', signal: undefined, models: {},
  })
  const out = await providers.openrouter()
  assert.equal(out.ok, false)
  assert.match(out.reason, /HTTP 429/)
})

// -------------------------------------------------------------- заготовки

test('заготовки доступны без единой строчки настроек', async () => {
  let seen = ''
  const fetchImpl = async (url, init) => {
    seen = String(url)
    return { ok: true, json: async () => ({ text: 'готово' }) }
  }
  const providers = makeProviders(depsWith(fetchImpl), {
    bytes, mime: 'audio/webm', lang: 'ru', signal: undefined, models: {},
  })
  const out = await providers.openai()
  assert.equal(out.ok, true)
  assert.equal(out.text, 'готово')
  assert.equal(seen, 'https://api.openai.com/v1/audio/transcriptions')
})

test('у каждой заготовки заполнено всё, что нужно для работы', () => {
  for (const key of PRESET_KEYS) {
    const preset = PRESET_PROVIDERS[key]
    assert.ok(preset.baseURL.startsWith('https://'), key + ': адрес')
    assert.ok(preset.model, key + ': модель')
    assert.ok(preset.keyEnv, key + ': имя ключа')
    assert.ok(CUSTOM_TEMPLATES.includes(preset.template), key + ': шаблон')
  }
})

test('у OpenRouter чат-шаблон, потому что обычного эндпоинта у него нет', () => {
  assert.equal(PRESET_PROVIDERS.openrouter.template, 'openai-chat-audio')
})

test('известные имена — это встроенные плюс заготовки', () => {
  assert.deepEqual(KNOWN_KEYS, PROVIDER_KEYS.concat(PRESET_KEYS))
})

test('своё описание перекрывает заготовку целиком', async () => {
  let seen = ''
  const fetchImpl = async (url) => { seen = String(url); return { ok: true, json: async () => ({ text: 'своё' }) } }
  const spec = {
    key: 'openai', template: 'openai-transcriptions',
    baseURL: 'https://свой-шлюз.local/v1', model: 'моя-модель', keyEnv: 'MY_KEY',
  }
  const providers = makeProviders(customDeps(fetchImpl, spec), {
    bytes, mime: 'audio/webm', lang: 'ru', signal: undefined, models: {},
  })
  const out = await providers.openai()
  assert.equal(out.text, 'своё')
  assert.equal(seen, 'https://свой-шлюз.local/v1/audio/transcriptions')
})

test('встроенный движок своим описанием не перекрыть', async () => {
  const spec = { key: 'groq', template: 'openai-transcriptions', baseURL: 'https://evil.example', model: 'x' }
  const providers = makeProviders(customDeps(async () => ({}), spec), {
    bytes, mime: 'audio/wav', lang: 'ru', signal: undefined, models: {},
  })
  assert.equal(providers.groq.name, 'groq')
})
