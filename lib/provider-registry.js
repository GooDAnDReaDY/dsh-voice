// lib/provider-registry.js — Strategy pattern and extensible registry for STT providers (#306)
import { readHttpError, safeJson, isAutoLang, fileName, chatAudioFormat } from './provider-http.js'

const CHAT_AUDIO_PROMPT =
  'Transcribe the audio verbatim. Reply with the transcript text only, '
  + 'without comments, quotes or formatting.'

function bindNamedRunner(name, fn) {
  Object.defineProperty(fn, 'name', { value: name, configurable: true })
  return fn
}

/**
 * Abstract base strategy for Speech-to-Text providers.
 */
export class SpeechToTextProvider {
  /**
   * @param {{ key: string, kind?: 'browser' | 'cloud' | 'local' | 'custom', defaultModel?: string, requiresWav?: boolean }} meta
   */
  constructor(meta) {
    if (!meta || !meta.key) throw new Error('SpeechToTextProvider requires a non-empty key')
    this.key = String(meta.key)
    this.kind = meta.kind || 'cloud'
    this.defaultModel = meta.defaultModel || ''
    this.requiresWav = Boolean(meta.requiresWav)
  }

  pickModel(models) {
    const chosen = models && typeof models[this.key] === 'string' ? models[this.key].trim() : ''
    return chosen || this.defaultModel
  }

  /**
   * Validate configuration for this provider.
   * @param {Record<string, any>} _cfg
   * @returns {{ valid: boolean, reason?: string }}
   */
  validateConfig(_cfg) {
    return { valid: true }
  }

  /**
   * Check provider readiness/health.
   * @param {Record<string, any>} _deps
   * @returns {Promise<{ ok: boolean, reason?: string }>}
   */
  async healthcheck(_deps) {
    return { ok: true }
  }

  /**
   * Execute speech recognition strategy.
   * @param {Record<string, any>} _deps
   * @param {Record<string, any>} _req
   * @returns {Promise<{ ok: boolean, provider: string, text?: string, reason?: string }>}
   */
  async transcribe(_deps, _req) {
    return { ok: false, provider: this.key, reason: `${this.key}: not implemented` }
  }

  /**
   * Create a zero-arg chain runner bound to deps and request context.
   */
  createRunner(deps, req) {
    return bindNamedRunner(this.key, async () => this.transcribe(deps, req))
  }
}

export class BrowserStubProvider extends SpeechToTextProvider {
  constructor(key = 'browser', reasonSuffix = 'recognition runs in the page, the host has no browser engine') {
    super({ key, kind: 'browser' })
    this.reasonSuffix = reasonSuffix
  }

  async transcribe() {
    return {
      ok: false,
      provider: this.key,
      reason: `${this.key}: ${this.reasonSuffix}`,
    }
  }
}

export class DeepgramProvider extends SpeechToTextProvider {
  constructor(defaultModel = 'nova-2') {
    super({ key: 'deepgram', kind: 'cloud', defaultModel })
  }

  validateConfig(cfg) {
    if (!cfg?.deepgramKeyEnv) return { valid: false, reason: 'missing deepgramKeyEnv' }
    return { valid: true }
  }

  async healthcheck({ resolveKey, cfg }) {
    const key = await resolveKey?.(cfg?.deepgramKeyEnv)
    return key ? { ok: true } : { ok: false, reason: `no ${cfg?.deepgramKeyEnv || 'DEEPGRAM_API_KEY'}` }
  }

  async transcribe(deps, req) {
    const { resolveKey, fetchImpl, cfg } = deps
    const { bytes, mime, lang, signal, models, effectiveKeywords } = req
    const key = await resolveKey(cfg.deepgramKeyEnv)
    if (!key) return { ok: false, provider: 'deepgram', reason: `no ${cfg.deepgramKeyEnv}` }
    const model = this.pickModel(models)
    const base = String(cfg.deepgramBaseUrl || 'https://api.deepgram.com').replace(/\/+$/, '')
    const url = `${base}/v1/listen?model=${encodeURIComponent(model)}`
      + (!isAutoLang(lang) ? `&language=${encodeURIComponent(lang)}` : '')
      + (effectiveKeywords ? `&keywords=${encodeURIComponent(effectiveKeywords)}` : '')
      + '&smart_format=true'
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { authorization: `Token ${key}`, 'content-type': mime },
      body: bytes,
      signal,
      keepalive: true,
    })
    if (!res.ok) throw await readHttpError(res, 'Deepgram', 'deepgram')
    let data
    try { data = await safeJson(res, 'Deepgram') } catch (e) {
      return { ok: false, provider: 'deepgram', reason: e.message }
    }
    const text = (data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '').trim()
    return { ok: text.length > 0, provider: 'deepgram', text, reason: text ? '' : 'empty transcript' }
  }
}

export class GroqProvider extends SpeechToTextProvider {
  constructor(defaultModel = 'whisper-large-v3-turbo') {
    super({ key: 'groq', kind: 'cloud', defaultModel })
  }

  validateConfig(cfg) {
    if (!cfg?.groqKeyEnv) return { valid: false, reason: 'missing groqKeyEnv' }
    return { valid: true }
  }

  async healthcheck({ resolveKey, cfg }) {
    const key = await resolveKey?.(cfg?.groqKeyEnv)
    return key ? { ok: true } : { ok: false, reason: `no ${cfg?.groqKeyEnv || 'GROQ_API_KEY'}` }
  }

  async transcribe(deps, req) {
    const { resolveKey, fetchImpl, cfg } = deps
    const { bytes, mime, lang, signal, models, effectivePrompt } = req
    const key = await resolveKey(cfg.groqKeyEnv)
    if (!key) return { ok: false, provider: 'groq', reason: `no ${cfg.groqKeyEnv}` }
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: mime }), fileName(mime))
    form.append('model', this.pickModel(models))
    if (!isAutoLang(lang)) form.append('language', lang)
    if (effectivePrompt) form.append('prompt', effectivePrompt)
    form.append('response_format', 'json')
    const res = await fetchImpl('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: form,
      signal,
      keepalive: true,
    })
    if (!res.ok) throw await readHttpError(res, 'Groq', 'groq')
    let data
    try { data = await safeJson(res, 'Groq') } catch (e) {
      return { ok: false, provider: 'groq', reason: e.message }
    }
    const text = (data?.text || '').trim()
    return { ok: text.length > 0, provider: 'groq', text, reason: text ? '' : 'empty transcript' }
  }
}

export class HuggingFaceProvider extends SpeechToTextProvider {
  constructor(defaultModel = 'openai/whisper-large-v3') {
    super({ key: 'hf', kind: 'cloud', defaultModel })
  }

  validateConfig(cfg) {
    if (!cfg?.hfTokenEnv) return { valid: false, reason: 'missing hfTokenEnv' }
    return { valid: true }
  }

  async healthcheck({ resolveKey, cfg }) {
    const token = await resolveKey?.(cfg?.hfTokenEnv)
    return token ? { ok: true } : { ok: false, reason: `no ${cfg?.hfTokenEnv || 'HF_TOKEN'}` }
  }

  async transcribe(deps, req) {
    const { resolveKey, fetchImpl, cfg } = deps
    const { bytes, mime, signal, models } = req
    const token = await resolveKey(cfg.hfTokenEnv)
    if (!token) return { ok: false, provider: 'hf', reason: `no ${cfg.hfTokenEnv}` }
    const model = this.pickModel(models)
    const res = await fetchImpl(`https://router.huggingface.co/hf-inference/models/${model}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': mime, 'x-wait-for-model': 'true' },
      body: bytes,
      signal,
      keepalive: true,
    })
    if (!res.ok) throw await readHttpError(res, 'HF', 'hf')
    let data
    try { data = await safeJson(res, 'HF') } catch (e) {
      return { ok: false, provider: 'hf', reason: e.message }
    }
    const text = (data?.text || '').trim()
    return { ok: text.length > 0, provider: 'hf', text, reason: text ? '' : 'empty transcript' }
  }
}

export class LocalWhisperProvider extends SpeechToTextProvider {
  constructor() {
    super({ key: 'local-whisper', kind: 'local', defaultModel: '', requiresWav: true })
  }

  validateConfig(cfg) {
    if (!cfg?.whisperUrl) return { valid: false, reason: 'missing whisperUrl' }
    return { valid: true }
  }

  async transcribe(deps, req) {
    const { fetchImpl, cfg } = deps
    const { bytes, mime, lang, signal, effectivePrompt } = req
    let sendBytes = bytes
    let sendMime = mime
    if (!mime.includes('wav')) {
      if (typeof deps.toWav !== 'function') {
        return { ok: false, provider: 'local-whisper', reason: 'local whisper needs WAV, no converter configured' }
      }
      try {
        sendBytes = await deps.toWav(bytes, signal)
        sendMime = 'audio/wav'
      } catch (e) {
        return { ok: false, provider: 'local-whisper', reason: `local whisper: ${String(e && e.message || e)}` }
      }
    }
    const form = new FormData()
    form.append('file', new Blob([sendBytes], { type: sendMime }), fileName(sendMime))
    form.append('language', isAutoLang(lang) ? 'auto' : lang)
    form.append('translate', 'false')
    if (effectivePrompt) form.append('prompt', effectivePrompt)
    form.append('response_format', 'json')
    const res = await fetchImpl(cfg.whisperUrl, { method: 'POST', body: form, signal })
    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try { const e = await res.json(); if (e?.error) detail = e.error } catch { /* body is not json */ }
      return { ok: false, provider: 'local-whisper', reason: `local whisper: ${detail}` }
    }
    let data
    try { data = await safeJson(res, 'local whisper') } catch (e) {
      return { ok: false, provider: 'local-whisper', reason: e.message }
    }
    const text = (data?.text || '').trim()
    return { ok: text.length > 0, provider: 'local-whisper', text, reason: text ? '' : 'empty transcript' }
  }
}

export class SenseVoiceProvider extends SpeechToTextProvider {
  constructor(defaultModel = 'SenseVoiceSmall') {
    super({ key: 'sensevoice', kind: 'local', defaultModel, requiresWav: true })
  }

  validateConfig(cfg) {
    if (!cfg?.sensevoiceUrl) return { valid: false, reason: 'missing sensevoiceUrl' }
    return { valid: true }
  }

  async transcribe(deps, req) {
    const { fetchImpl, cfg } = deps
    const { bytes, mime, lang, signal, models, effectivePrompt } = req
    const url = String(cfg.sensevoiceUrl || 'http://127.0.0.1:6006/api/v1/asr').trim()
    let sendBytes = bytes
    let sendMime = mime
    if (!mime.includes('wav')) {
      if (typeof deps.toWav !== 'function') {
        return { ok: false, provider: 'sensevoice', reason: 'sensevoice needs WAV, no converter configured' }
      }
      try {
        sendBytes = await deps.toWav(bytes, signal)
        sendMime = 'audio/wav'
      } catch (e) {
        return { ok: false, provider: 'sensevoice', reason: `sensevoice: ${String(e && e.message || e)}` }
      }
    }
    const form = new FormData()
    form.append('file', new Blob([sendBytes], { type: sendMime }), fileName(sendMime))
    const isOpenAI = url.includes('/transcriptions')
    if (isOpenAI) {
      form.append('model', this.pickModel(models))
      if (!isAutoLang(lang)) form.append('language', lang)
      if (effectivePrompt) form.append('prompt', effectivePrompt)
      form.append('response_format', 'json')
    }

    let res
    try {
      res = await fetchImpl(url, { method: 'POST', body: form, signal })
    } catch (e) {
      return { ok: false, provider: 'sensevoice', reason: `sensevoice: ${String(e && e.message || e)}` }
    }

    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try { const e = await res.json(); if (e?.error) detail = e.error } catch { /* body is not json */ }
      return { ok: false, provider: 'sensevoice', reason: `sensevoice: ${detail}` }
    }

    let data
    try {
      data = await res.json()
    } catch {
      return { ok: false, provider: 'sensevoice', reason: 'sensevoice: invalid json response' }
    }

    let text = String(data?.text || data?.transcript || '').trim()
    text = text.replace(/<\|[^|>]+\|>/g, '').trim()
    return {
      ok: text.length > 0,
      provider: 'sensevoice',
      text,
      reason: text ? '' : 'empty transcript',
    }
  }
}

export class OpenAICompatibleProvider extends SpeechToTextProvider {
  /**
   * @param {{ key: string, template?: string, baseURL?: string, model?: string, keyEnv?: string, prompt?: string }} spec
   */
  constructor(spec) {
    super({
      key: spec.key,
      kind: 'custom',
      defaultModel: spec.model || '',
    })
    this.spec = spec
  }

  validateConfig() {
    if (!this.spec?.baseURL) return { valid: false, reason: `${this.key}: no baseURL` }
    if (!this.spec?.model) return { valid: false, reason: `${this.key}: no model` }
    return { valid: true }
  }

  async transcribe(deps, req) {
    const { resolveKey, fetchImpl } = deps
    const { bytes, mime, lang, signal, models, effectivePrompt } = req
    const label = this.key
    const base = String(this.spec.baseURL || '').replace(/\/+$/, '')
    const chosen = models && typeof models[label] === 'string' ? models[label].trim() : ''
    const model = chosen || this.spec.model

    if (!base) return { ok: false, provider: label, reason: `${label}: no baseURL` }
    if (!model) return { ok: false, provider: label, reason: `${label}: no model` }

    let headers = {}
    if (this.spec.keyEnv) {
      const key = await resolveKey(this.spec.keyEnv)
      if (!key) return { ok: false, provider: label, reason: `no ${this.spec.keyEnv}` }
      headers = { authorization: `Bearer ${key}` }
    }

    const viaTranscriptions = async () => {
      const form = new FormData()
      form.append('file', new Blob([bytes], { type: mime }), fileName(mime))
      form.append('model', model)
      if (lang && lang !== 'auto') form.append('language', lang)
      if (effectivePrompt) form.append('prompt', effectivePrompt)
      form.append('response_format', 'json')
      const res = await fetchImpl(`${base}/audio/transcriptions`, {
        method: 'POST', headers, body: form, signal,
      })
      if (!res.ok) throw await readHttpError(res, label, label)
      const data = await safeJson(res, label)
      return (data?.text || '').trim()
    }

    const viaChatAudio = async () => {
      let sendBytes = bytes
      let format = chatAudioFormat(mime)
      if (!format) {
        if (typeof deps.toWav !== 'function') {
          throw new Error(`${label}: chat template needs wav or mp3, unsupported format ${mime}`)
        }
        sendBytes = await deps.toWav(bytes, signal)
        format = 'wav'
      }
      const ask = (this.spec.prompt || CHAT_AUDIO_PROMPT)
        + (effectivePrompt ? ` Vocabulary hints (spell these correctly): ${effectivePrompt}.` : '')
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
      if (!res.ok) throw await readHttpError(res, label, label)
      const data = await safeJson(res, label)
      return String(data?.choices?.[0]?.message?.content || '').trim()
    }

    let text
    try {
      text = this.spec.template === 'openai-chat-audio'
        ? await viaChatAudio()
        : await viaTranscriptions()
    } catch (e) {
      return { ok: false, provider: label, reason: `${label}: ${String(e && e.message || e)}` }
    }
    return { ok: text.length > 0, provider: label, text, reason: text ? '' : 'empty transcript' }
  }
}

/**
 * Registry managing STT provider strategies and instantiating chain runners.
 */
export class ProviderRegistry {
  constructor() {
    /** @type {Map<string, SpeechToTextProvider>} */
    this.providers = new Map()
    /** @type {Set<string>} */
    this.builtinKeys = new Set()
  }

  /**
   * Register a provider strategy.
   * @param {SpeechToTextProvider} strategy
   * @param {{ builtin?: boolean }} [options]
   */
  register(strategy, options = {}) {
    if (!(strategy instanceof SpeechToTextProvider)) {
      throw new TypeError('ProviderRegistry.register requires a SpeechToTextProvider instance')
    }
    this.providers.set(strategy.key, strategy)
    if (options.builtin) {
      this.builtinKeys.add(strategy.key)
    }
    return this
  }

  get(key) {
    return this.providers.get(key)
  }

  has(key) {
    return this.providers.has(key)
  }

  keys() {
    return Array.from(this.providers.keys())
  }

  /**
   * Build execution runners for runChain(), applying presets and customProviders.
   */
  buildRunners(deps, req) {
    const vocab = Array.isArray(req.vocabulary)
      ? req.vocabulary.map((w) => String(w || '').trim()).filter(Boolean).join(', ')
      : ''
    const effectivePrompt = (typeof req.promptText === 'string' && req.promptText.trim()) ? req.promptText.trim() : vocab
    const effectiveKeywords = (typeof req.keywords === 'string' && req.keywords.trim()) ? req.keywords.trim() : vocab
    const enrichedReq = { ...req, effectivePrompt, effectiveKeywords }

    const out = {}
    for (const [key, strategy] of this.providers.entries()) {
      out[key] = strategy.createRunner(deps, enrichedReq)
    }

    const customList = Array.isArray(deps?.cfg?.customProviders) ? deps.cfg.customProviders : []
    for (const spec of customList) {
      const key = String(spec && spec.key || '').trim()
      if (!key || this.builtinKeys.has(key)) continue
      const customStrategy = new OpenAICompatibleProvider({ ...spec, key })
      out[key] = customStrategy.createRunner(deps, enrichedReq)
    }
    return out
  }
}

export function createDefaultProviderRegistry(presetProviders = {}) {
  const registry = new ProviderRegistry()
  registry.register(new BrowserStubProvider('browser', 'recognition runs in the page, the host has no browser engine'), { builtin: true })
  registry.register(new BrowserStubProvider('browser-webgpu', 'recognition runs in the page via WebGPU/WASM, the host has no browser engine'), { builtin: true })
  registry.register(new DeepgramProvider(), { builtin: true })
  registry.register(new GroqProvider(), { builtin: true })
  registry.register(new HuggingFaceProvider(), { builtin: true })
  registry.register(new LocalWhisperProvider(), { builtin: true })
  registry.register(new SenseVoiceProvider(), { builtin: true })

  for (const [key, spec] of Object.entries(presetProviders)) {
    if (!registry.has(key)) {
      registry.register(new OpenAICompatibleProvider({ ...spec, key }), { builtin: false })
    }
  }
  return registry
}
