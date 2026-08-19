// Четыре провайдера распознавания речи. Чистые функции: сеть приходит
// параметром (fetchImpl), ключи — через resolveKey, поэтому всё проверяется
// без реальных запросов.

export const PROVIDER_KEYS = ['deepgram', 'groq', 'hf', 'local-whisper']

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

export function makeProviders(deps, req) {
  const { resolveKey, fetchImpl, cfg } = deps
  const { bytes, mime, lang, signal, models } = req

  async function deepgram() {
    const key = await resolveKey(cfg.deepgramKeyEnv)
    if (!key) return { ok: false, provider: 'deepgram', reason: `no ${cfg.deepgramKeyEnv}` }
    const model = pickModel(models, 'deepgram')
    const url = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}`
      + `&language=${encodeURIComponent(lang)}&smart_format=true`
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
    form.append('language', lang)
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
    form.append('language', lang)
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

  return { deepgram, groq, hf, 'local-whisper': localWhisper }
}
