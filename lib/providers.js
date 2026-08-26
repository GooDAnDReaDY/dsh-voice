// Провайдеры распознавания речи: четыре встроенных плюс любые свои, объявленные
// в настройках. Чистые функции: сеть приходит параметром (fetchImpl), ключи —
// через resolveKey, поэтому всё проверяется без реальных запросов.

// 'browser' стоит в этом списке, но работает не здесь: речь распознаёт сам
// браузер, до хоста звук не доходит. Ключ нужен, чтобы такую цепочку принимал
// и валидатор настроек, и перебор ниже — иначе цепочка ['browser', 'groq'] на
// хосте оборвалась бы на первом же шаге вместо перехода к groq.
export const PROVIDER_KEYS = ['browser', 'deepgram', 'groq', 'hf', 'local-whisper']

// Свой провайдер описывается одним из двух шаблонов, потому что
// OpenAI-совместимые API разошлись: у OpenRouter, например, нет
// /audio/transcriptions вовсе, и распознавание там идёт через чат.
export const CUSTOM_TEMPLATES = ['openai-transcriptions', 'openai-chat-audio']

// Готовые провайдеры: то же самое, что свой провайдер, только адрес, модель и
// имя ключа уже проставлены. Нужен лишь ключ.
//
// Каждый адрес проверен запросом без ключа: все отвечают 401 «дайте ключ», то
// есть путь существует. Модель — разумная отправная точка, её можно заменить
// в строке цепочки, не трогая остальное.
//
// Своим провайдером с тем же именем можно перекрыть любую заготовку целиком:
// это не встроенный движок, а всего лишь заранее заполненная анкета.
export const PRESET_PROVIDERS = {
  openai: {
    template: 'openai-transcriptions',
    baseURL: 'https://api.openai.com/v1',
    model: 'whisper-1',
    keyEnv: 'OPENAI_API_KEY',
  },
  siliconflow: {
    template: 'openai-transcriptions',
    baseURL: 'https://api.siliconflow.cn/v1',
    model: 'FunAudioLLM/SenseVoiceSmall',
    keyEnv: 'SILICONFLOW_API_KEY',
  },
  deepinfra: {
    template: 'openai-transcriptions',
    baseURL: 'https://api.deepinfra.com/v1/openai',
    model: 'openai/whisper-large-v3-turbo',
    keyEnv: 'DEEPINFRA_API_KEY',
  },
  fireworks: {
    template: 'openai-transcriptions',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    model: 'whisper-v3-turbo',
    keyEnv: 'FIREWORKS_API_KEY',
  },
  mistral: {
    template: 'openai-transcriptions',
    baseURL: 'https://api.mistral.ai/v1',
    model: 'voxtral-mini-latest',
    keyEnv: 'MISTRAL_API_KEY',
  },
  // У OpenRouter нет /audio/transcriptions вовсе — только через чат.
  openrouter: {
    template: 'openai-chat-audio',
    baseURL: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-2.5-flash',
    keyEnv: 'OPENROUTER_API_KEY',
  },
}

export const PRESET_KEYS = Object.keys(PRESET_PROVIDERS)

/** Все имена, которые можно ставить в цепочку без объявления своего провайдера. */
export const KNOWN_KEYS = PROVIDER_KEYS.concat(PRESET_KEYS)

const CHAT_AUDIO_PROMPT =
  'Transcribe the audio verbatim. Reply with the transcript text only, '
  + 'without comments, quotes or formatting.'

// Форматы, которые чат-шаблон принимает в input_audio. Всё остальное —
// включая webm/opus, который пишет браузер, — сначала перегоняем в WAV.
function chatAudioFormat(mime) {
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  return ''
}

export const DEFAULT_MODELS = {
  deepgram: 'nova-2',
  groq: 'whisper-large-v3-turbo',
  hf: 'openai/whisper-large-v3',
  'local-whisper': '',
}

function pickModel(models, key) {
  const chosen = models && typeof models[key] === 'string' ? models[key].trim() : ''
  return chosen || DEFAULT_MODELS[key]
}

function fileName(mime) {
  if (mime.includes('wav')) return 'audio.wav'
  if (mime.includes('ogg')) return 'audio.ogg'
  if (mime.includes('mp4')) return 'audio.m4a'
  return 'audio.webm'
}

// Автоязык: пусто, 'auto' или список ('ru,en') — провайдер определяет сам,
// поле language не отправляется. whisper.cpp при этом получает -l auto.
function isAutoLang(lang) {
  return !lang || lang === 'auto' || String(lang).includes(',')
}

export function makeProviders(deps, req) {
  const { resolveKey, fetchImpl, cfg } = deps
  const { bytes, mime, lang, signal, models } = req
  const vocab = Array.isArray(req.vocabulary)
    ? req.vocabulary.map((w) => String(w || '').trim()).filter(Boolean).join(', ')
    : ''

  async function deepgram() {
    const key = await resolveKey(cfg.deepgramKeyEnv)
    if (!key) return { ok: false, provider: 'deepgram', reason: `no ${cfg.deepgramKeyEnv}` }
    const model = pickModel(models, 'deepgram')
    const url = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}`
      + (!isAutoLang(lang) ? `&language=${encodeURIComponent(lang)}` : '') + '&smart_format=true'
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { authorization: `Token ${key}`, 'content-type': mime },
      body: bytes,
      signal,
    })
    if (!res.ok) throw new Error(`Deepgram HTTP ${res.status}`)
    const data = await res.json()
    const text = (data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '').trim()
    return { ok: text.length > 0, provider: 'deepgram', text, reason: text ? '' : 'empty transcript' }
  }

  async function groq() {
    const key = await resolveKey(cfg.groqKeyEnv)
    if (!key) return { ok: false, provider: 'groq', reason: `no ${cfg.groqKeyEnv}` }
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: mime }), fileName(mime))
    form.append('model', pickModel(models, 'groq'))
    if (!isAutoLang(lang)) form.append('language', lang)
    form.append('response_format', 'json')
    const res = await fetchImpl('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: form,
      signal,
    })
    if (!res.ok) throw new Error(`Groq HTTP ${res.status}`)
    const data = await res.json()
    const text = (data?.text || '').trim()
    return { ok: text.length > 0, provider: 'groq', text, reason: text ? '' : 'empty transcript' }
  }

  async function hf() {
    const token = await resolveKey(cfg.hfTokenEnv)
    if (!token) return { ok: false, provider: 'hf', reason: `no ${cfg.hfTokenEnv}` }
    const model = pickModel(models, 'hf')
    const res = await fetchImpl(`https://router.huggingface.co/hf-inference/models/${model}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': mime, 'x-wait-for-model': 'true' },
      body: bytes,
      signal,
    })
    if (!res.ok) throw new Error(`HF HTTP ${res.status}`)
    const data = await res.json()
    const text = (data?.text || '').trim()
    return { ok: text.length > 0, provider: 'hf', text, reason: text ? '' : 'empty transcript' }
  }

  // whisper.cpp принимает только WAV — на webm/opus из браузера его сервер
  // отвечает "Invalid request". Перегоняем, если формат не WAV.
  async function localWhisper() {
    let sendBytes = bytes
    let sendMime = mime
    if (!mime.includes('wav')) {
      if (typeof deps.toWav !== 'function') {
        return { ok: false, provider: 'local-whisper', reason: 'local whisper needs WAV, no converter configured' }
      }
      try {
        sendBytes = await deps.toWav(bytes)
        sendMime = 'audio/wav'
      } catch (e) {
        return { ok: false, provider: 'local-whisper', reason: `local whisper: ${String(e && e.message || e)}` }
      }
    }
    const form = new FormData()
    form.append('file', new Blob([sendBytes], { type: sendMime }), fileName(sendMime))
    if (!isAutoLang(lang)) form.append('language', lang)
    if (vocab) form.append('prompt', vocab)
    form.append('response_format', 'json')
    const res = await fetchImpl(cfg.whisperUrl, { method: 'POST', body: form, signal })
    // whisper.cpp отвечает 400 с JSON-телом на внутренних сбоях (например, не
    // смог декодировать аудио) — читаем причину, а не бросаем исключение.
    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try { const e = await res.json(); if (e?.error) detail = e.error } catch { /* тело не json */ }
      return { ok: false, provider: 'local-whisper', reason: `local whisper: ${detail}` }
    }
    const data = await res.json()
    const text = (data?.text || '').trim()
    return { ok: text.length > 0, provider: 'local-whisper', text, reason: text ? '' : 'empty transcript' }
  }

  // Свой провайдер. Ключ в цепочке — его имя, поэтому в остальном коде он
  // ничем не отличается от встроенного.
  function customProvider(spec) {
    const label = spec.key
    const base = String(spec.baseURL || '').replace(/\/+$/, '')
    const model = pickModel(models, label) || spec.model

    async function auth() {
      if (!spec.keyEnv) return {}
      const key = await resolveKey(spec.keyEnv)
      if (!key) return null
      return { authorization: `Bearer ${key}` }
    }

    async function viaTranscriptions(headers) {
      const form = new FormData()
      form.append('file', new Blob([bytes], { type: mime }), fileName(mime))
      form.append('model', model)
      if (lang && lang !== 'auto') form.append('language', lang)
      form.append('response_format', 'json')
      const res = await fetchImpl(`${base}/audio/transcriptions`, {
        method: 'POST', headers, body: form, signal,
      })
      if (!res.ok) throw new Error(`${label} HTTP ${res.status}`)
      const data = await res.json()
      return (data?.text || '').trim()
    }

    async function viaChatAudio(headers) {
      let sendBytes = bytes
      let format = chatAudioFormat(mime)
      if (!format) {
        if (typeof deps.toWav !== 'function') {
          throw new Error(`${label} needs wav or mp3, no converter configured`)
        }
        sendBytes = await deps.toWav(bytes)
        format = 'wav'
      }
      const ask = (spec.prompt || CHAT_AUDIO_PROMPT)
        + (vocab ? ` Vocabulary hints (spell these correctly): ${vocab}.` : '')
        + (lang && lang !== 'auto' ? ` The audio language is ${lang}.` : '')
      const res = await fetchImpl(`${base}/chat/completions`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: ask },
              { type: 'input_audio', input_audio: { data: Buffer.from(sendBytes).toString('base64'), format } },
            ],
          }],
        }),
        signal,
      })
      if (!res.ok) throw new Error(`${label} HTTP ${res.status}`)
      const data = await res.json()
      return String(data?.choices?.[0]?.message?.content || '').trim()
    }

    return async function run() {
      if (!base) return { ok: false, provider: label, reason: `${label}: no baseURL` }
      if (!model) return { ok: false, provider: label, reason: `${label}: no model` }
      const headers = await auth()
      if (headers === null) return { ok: false, provider: label, reason: `no ${spec.keyEnv}` }
      let text
      try {
        text = spec.template === 'openai-chat-audio'
          ? await viaChatAudio(headers)
          : await viaTranscriptions(headers)
      } catch (e) {
        // Отказ одного провайдера не должен ронять цепочку — она сама решит,
        // идти дальше или сдаться.
        return { ok: false, provider: label, reason: `${label}: ${String(e && e.message || e)}` }
      }
      return { ok: text.length > 0, provider: label, text, reason: text ? '' : 'empty transcript' }
    }
  }

  // Если звук всё-таки доехал до хоста с 'browser' в цепочке, значит
  // браузерная нога не сработала: отказываем понятно и идём к следующему.
  async function browser() {
    return {
      ok: false,
      provider: 'browser',
      reason: 'browser: распознавание идёт в браузере, на хосте его нет',
    }
  }

  const out = { browser, deepgram, groq, hf, 'local-whisper': localWhisper }

  // Заготовки: те же свои провайдеры, только анкета заполнена заранее.
  for (const key of PRESET_KEYS) {
    if (out[key]) continue
    out[key] = customProvider({ ...PRESET_PROVIDERS[key], key })
  }

  for (const spec of Array.isArray(cfg.customProviders) ? cfg.customProviders : []) {
    const key = String(spec && spec.key || '').trim()
    // Встроенные движки не перекрываем: опечатка в имени тихо подменила бы
    // рабочего провайдера в чужой цепочке. А заготовку перекрыть можно — она
    // для того и заготовка, чтобы её правили.
    if (!key || PROVIDER_KEYS.includes(key)) continue
    out[key] = customProvider({ ...spec, key })
  }
  return out
}
