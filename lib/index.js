// dsh-voice — хост-половина.
//
// Два режима ввода голосом, у каждого своя цепочка провайдеров:
//   dictation — браузер режет речь по паузам и шлёт куски, текст дописывается
//               в строку ввода;
//   message   — одна запись целиком, текст уходит агенту после окна отмены.
//
// Роуты:
//   POST /dsh-voice/transcribe  {dataBase64, mimeType, mode} -> {ok, text, provider, tookMs}
//   GET  /dsh-voice/status      -> {ok, whisperRunning, modes}
//
// Ключи провайдеров читаются на хосте через ctx.credentials и в браузер не
// попадают.

import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { runChain } from './chain.js'
import { makeProviders, PROVIDER_KEYS, PRESET_KEYS, KNOWN_KEYS, DEFAULT_MODELS, CUSTOM_TEMPLATES } from './providers.js'
import { toWav16k } from './wav.js'
import { normalizePhrase } from './normalize.js'

function isAutoLang(lang) {
  return !lang || lang === 'auto' || String(lang).includes(',')
}

export const name = 'dsh-voice'
export const inject = ['tools', 'credentials', 'webServer', 'shell', 'settings', 'llm']

const ChainEntry = z.object({
  provider: z.string().default('local-whisper')
    .description(`Provider key. Built in: ${PROVIDER_KEYS.join(', ')}. `
      + `Ready-made, just add the key: ${PRESET_KEYS.join(', ')}. `
      + 'Or the name of an entry from customProviders. '
      + '"browser" recognises speech in the page itself — no key, no upload to this host, '
      + 'text appears while you speak; put a normal provider after it as a fallback.'),
  model: z.string().default('')
    .description('Model override. Empty means the provider default.'),
})

// Свой провайдер: всё, что нужно, чтобы сходить в чужой OpenAI-совместимый API.
const CustomProvider = z.object({
  key: z.string().default('')
    .description('Name used in the chains above. Must differ from the built-in keys.'),
  template: z.string().default('openai-transcriptions')
    .description(`API shape: ${CUSTOM_TEMPLATES.join(' or ')}. `
      + 'OpenRouter has no /audio/transcriptions, use openai-chat-audio there.'),
  baseURL: z.string().default('')
    .description('API root without a trailing slash, e.g. https://openrouter.ai/api/v1'),
  model: z.string().default(''),
  keyEnv: z.string().default('')
    .description('Credential name holding the API key. Empty means no authorization header.'),
  prompt: z.string().default('')
    .description('openai-chat-audio only: instruction sent along with the audio. '
      + 'Empty means the built-in one.'),
})

export const Config = z.object({
  dictation: z.object({
    chain: z.array(ChainEntry)
      .default([{ provider: 'deepgram', model: '' }, { provider: 'groq', model: '' }, { provider: 'local-whisper', model: '' }])
      .description('Fallback chain for dictation. Speed matters more than accuracy here.'),
    language: z.string().default('ru'),
    vadSilenceMs: z.number().default(700)
      .description('Silence longer than this ends a phrase and sends the chunk.'),
    sendDelayMs: z.number().default(0)
      .description('Dictation: wait this many ms after a phrase before appending it, with a cancel window. 0 disables the delay.'),
    polish: z.boolean().default(false)
      .description('Polish the transcript through the harness model before inserting: punctuation, paragraphs, filler-word removal.'),
    stream: z.boolean().default(false)
      .description('Continuous dictation: cut phrases by a timer instead of waiting for a long silence, so text flows while you speak.'),
    streamChunkMs: z.number().default(1200)
      .description('Continuous dictation: phrase length in ms of uninterrupted speech before the chunk is sent.'),
    vadAdapt: z.number().min(0).max(1).default(0)
      .description('Adaptive silence threshold: 0 = fixed (current behaviour); >0 shrinks the threshold during dense speech and grows it during pauses.'),
  }).default({}),
  message: z.object({
    chain: z.array(ChainEntry)
      .default([{ provider: 'groq', model: '' }, { provider: 'hf', model: '' }, { provider: 'local-whisper', model: '' }])
      .description('Fallback chain for voice messages. Accuracy matters more than speed.'),
    language: z.string().default('ru'),
    autoSendMs: z.number().default(4000)
      .description('Cancel window before the recognized text is sent to the agent.'),
    sessionCommands: z.boolean().default(false)
      .description('Voice session commands: a clean "send", "cancel", "stop", "continue" does not become text — it drives the composer/session.'),
    polishSend: z.boolean().default(false)
      .description('Polish the whole composed draft through the model right before sending, not just single phrases.'),
  }).default({}),
  hotkey: z.string().default('Control')
    .description('Hold this key anywhere in the page to record a voice message; release to send, '
      + 'Escape to discard. Modifier names (Control, Alt, Shift) or a KeyboardEvent code. '
      + 'Empty disables the hotkey.'),
  customProviders: z.array(CustomProvider).default([])
    .description('Own recognition providers, usable in both chains next to the built-in ones.'),
  deepgramKeyEnv: z.string().default('DEEPGRAM_API_KEY'),
  groqKeyEnv: z.string().default('GROQ_API_KEY'),
  hfTokenEnv: z.string().default('HF_TOKEN'),
  whisperUrl: z.string().default('http://127.0.0.1:8001/inference'),
  whisperBin: z.string().default('whisper-server')
    .description('whisper.cpp server binary, looked up in PATH unless an absolute path is given.'),
  whisperModel: z.string().default('')
    .description('Absolute path to the ggml model. Autostart stays off while this is empty; '
      + 'point it at your own model file to let the plugin launch whisper.cpp itself.'),
  autoStart: z.boolean().default(true)
    .description('Launch the local whisper.cpp server on activation if the port is free. '
      + 'Requires whisperModel to be set.'),
  ffmpegBin: z.string().default('ffmpeg')
    .description('ffmpeg used to convert browser webm/opus into the WAV that whisper.cpp requires.'),
  timeoutMs: z.number().default(120000),
  maxFileBytes: z.number().default(25 * 1024 * 1024),
  normalizeTranscript: z.boolean().default(false)
    .description('transcribe_audio: convert spoken numbers to digits and tidy punctuation.'),
  beep: z.boolean().default(false)
    .description('Play a short beep when recording starts and stops.'),
  localOnly: z.boolean().default(false)
    .description('Restrict both chains to local-whisper only: fully offline, no cloud providers.'),
  micDeviceId: z.string().default('')
    .description('Microphone device id for recording. Empty means the system default.'),
  historyLimit: z.number().default(20)
    .description('How many recent dictation inserts to keep for undo in the browser. 0 disables history.'),
  vocabulary: z.array(z.string()).default([])
    .description('Custom words (names, terms) hinted to providers so they recognize them correctly.'),
  voiceCommands: z.boolean().default(false)
    .description('During dictation, spoken edit commands ("new line", "paragraph") become real line breaks instead of words.'),
  wakeWord: z.string().default('')
    .description('Heads-free dictation: a phrase that, when recognized by the browser leg, starts a recording. Empty disables.'),
  bargeIn: z.boolean().default(false)
    .description('Ongoing playback or a long turn is interrupted by detected speech (browser leg).'),
  polishBaseUrl: z.string().default('')
    .description('Offline polish: OpenAI-compatible /chat/completions endpoint (e.g. local Ollama). Empty uses the harness model.'),
  polishModel: z.string().default('')
    .description('Offline polish: model id on polishBaseUrl.'),
  polishKeyEnv: z.string().default('')
    .description('Offline polish: credential name for the api key. Empty means no Authorization header.'),
})

const MIME_BY_EXT = {
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.mp4': 'audio/mp4',
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.flac': 'audio/flac', '.webm': 'audio/webm', '.aac': 'audio/aac',
}

function writeJson(res, code, body) {
  try {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(body))
  } catch { /* сокет мог закрыться */ }
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > maxBytes) { reject(new Error('body too large')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export function apply(ctx, baseConfig) {
  let child = null

  // Карточка настроек правит namespace с именем плагина. Пока хост его не
  // объявил через settings.register, снимок приходит пустым и нередактируемым:
  // поля серые, цепочки пустые, сохранять некуда. Чтение через live() заодно
  // означает, что правка применяется к следующему запросу, а не после
  // перезапуска процесса.
  let getConfig = () => baseConfig
  const live = () => Config(structuredClone(getConfig() ?? {})) ?? baseConfig

  ctx.inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(name, Config, { base: baseConfig })
    getConfig = () => scope.get() ?? baseConfig
    sctx.effect(() => () => { getConfig = () => baseConfig })
  })

  async function resolveKey(ref) {
    try {
      const resolved = await ctx.credentials.resolve(credentialRef(ref))
      if (resolved && resolved.value) return resolved.value
    } catch { /* падаем в окружение */ }
    return process.env[ref] || ''
  }

  async function whisperAlive() {
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 2000)
      const res = await fetch(live().whisperUrl.split('/inference')[0] + '/', { signal: controller.signal })
      clearTimeout(t)
      return res.ok
    } catch { return false }
  }

  async function startWhisper() {
    const cfg = live()
    if (!cfg.autoStart) return false
    // Без пути к модели запускать нечего: пакет не знает, где она лежит у
    // конкретного пользователя, и молча стартовать чужой бинарь не должен.
    if (!cfg.whisperModel) return false
    if (await whisperAlive()) return true
    try {
      const spec = ctx.shell.resolve({
        command: `${JSON.stringify(cfg.whisperBin)} -m ${JSON.stringify(cfg.whisperModel)}`
          + ` --host 127.0.0.1 --port 8001 -t 8 -p 1 -l ${isAutoLang(cfg.dictation.language) ? 'auto' : cfg.dictation.language}`,
        timeoutMs: 0,
        stdoutMaxBytes: 4 * 1024 * 1024,
      })
      child = ctx.shell.start(spec)
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 500))
        if (await whisperAlive()) return true
      }
      return false
    } catch { return false }
  }

  startWhisper().catch(() => {})

  // Общий путь распознавания: собрать провайдеров по цепочке режима и пройти её.
  async function transcribe(modeCfg, bytes, mime, signal) {
    const cfg = live()
    const customKeys = (Array.isArray(cfg.customProviders) ? cfg.customProviders : [])
      .map((c) => String(c && c.key || '').trim()).filter(Boolean)
    // Режим «только локальный whisper»: цепочка обрезается до него.
    const chain = cfg.localOnly
      ? (modeCfg.chain || []).filter((e) => e.provider === 'local-whisper')
      : (modeCfg.chain || [])
    const models = {}
    const order = []
    for (const entry of chain) {
      if (!KNOWN_KEYS.includes(entry.provider) && !customKeys.includes(entry.provider)) continue
      order.push(entry.provider)
      // Для своего провайдера модель по умолчанию живёт в его описании,
      // подставит makeProviders — здесь пусто означает «бери оттуда».
      models[entry.provider] = entry.model || DEFAULT_MODELS[entry.provider] || ''
    }
    if (cfg.localOnly && order.length === 0) {
      throw new Error('localOnly mode is on, but local-whisper is not in the chain')
    }
    const providers = makeProviders(
      { resolveKey, fetchImpl: fetch, cfg, toWav: (b) => toWav16k(b, cfg.ffmpegBin) },
      { bytes, mime, lang: modeCfg.language, signal, models, vocabulary: cfg.vocabulary },
    )
    return runChain(order, providers)
  }

  // Полировка транскрипта (#35) с поддержкой локального LLM (#47).
  // Ошибка/таймаут не блокирует: возвращаем сырой текст.
  async function polishText(text, modeCfg, signal) {
    const enable = modeCfg && (modeCfg.polish === true || modeCfg.polishSend === true)
    if (!enable || !text) return text
    const cfg = live()
    const ask =
      'Fix the punctuation and spelling of this dictated text and split it into '
      + 'paragraphs where the speaker changes topic. Remove filler words ("um", "uh", '
      + '"ээ", "ну", "как бы"). Keep the original language, wording and meaning. '
      + 'Reply with the polished text only:\n\n' + text
    try {
      // Локальный OpenAI-совместимый эндпоинт (#47), когда задан.
      if (cfg.polishBaseUrl) {
        const headers = { 'content-type': 'application/json' }
        if (cfg.polishKeyEnv) {
          const key = await resolveKey(cfg.polishKeyEnv)
          if (key) headers.authorization = 'Bearer ' + key
        }
        const res = await fetch(
          String(cfg.polishBaseUrl).replace(/\/+$/, '') + '/chat/completions',
          { method: 'POST', headers, signal, body: JSON.stringify({
            model: cfg.polishModel || 'local-model',
            messages: [{ role: 'user', content: ask }],
          }) })
        if (!res.ok) return text
        const data = await res.json().catch(() => null)
        const pick = data && data.choices && data.choices[0] && data.choices[0].message
          && data.choices[0].message.content
        return (pick && String(pick).trim()) || text
      }
      // Штатная модель харнесса.
      const llm = ctx.llm
      if (!llm || typeof llm.stream !== 'function') return text
      let acc = ''
      for await (const chunk of llm.stream({ messages: [{ role: 'user', content: ask }], signal })) {
        acc += (chunk && (chunk.text || (chunk.delta && chunk.delta.text))) || ''
      }
      const clean = acc.trim()
      return clean || text
    } catch { return text }
  }

  // Чистые голосовые команды сессии (#48). Возвращает название команды или null.
  // Распознаются на сервере, чтобы не попадать в текст композера.
  const SESSION_COMMANDS = [
    { re: /^(отправь|отправить|пошли|send)\s*[.!?]*$/i, cmd: 'send' },
    { re: /^(отмени|отмена|cancel|отменить)\s*[.!?]*$/i, cmd: 'cancel' },
    { re: /^(стоп|stop|хватит)\s*[.!?]*$/i, cmd: 'stop' },
    { re: /^(продолжи|continue|продолжай)\s*[.!?]*$/i, cmd: 'continue' },
  ]
  function sessionCommand(text) {
    const t = String(text || '').trim().toLowerCase()
    if (!t) return null
    for (const { re, cmd } of SESSION_COMMANDS) {
      if (re.test(t)) return cmd
    }
    return null
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-voice/status',
    handler: async (req, res) => {
      if (req.method !== 'GET') { writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET only' } }); return }
      const cfg = live()
      writeJson(res, 200, {
        ok: true,
        whisperRunning: await whisperAlive(),
        // Клавиша нужна браузерной половине: она вешает обработчик удержания.
        hotkey: cfg.hotkey,
        providers: KNOWN_KEYS.concat(
          (Array.isArray(cfg.customProviders) ? cfg.customProviders : [])
            .map((c) => String(c && c.key || '').trim()).filter(Boolean),
        ),
        modes: {
          dictation: {
            chain: cfg.dictation.chain, language: cfg.dictation.language,
            vadSilenceMs: cfg.dictation.vadSilenceMs,
            sendDelayMs: cfg.dictation.sendDelayMs, polish: cfg.dictation.polish,
            stream: cfg.dictation.stream, streamChunkMs: cfg.dictation.streamChunkMs,
            vadAdapt: cfg.dictation.vadAdapt,
          },
          message: {
            chain: cfg.message.chain, language: cfg.message.language,
            autoSendMs: cfg.message.autoSendMs, polish: cfg.message.polish,
            sessionCommands: cfg.message.sessionCommands, polishSend: cfg.message.polishSend,
          },
        },
        beep: cfg.beep,
        localOnly: cfg.localOnly,
        micDeviceId: cfg.micDeviceId,
        historyLimit: cfg.historyLimit,
        voiceCommands: cfg.voiceCommands,
        wakeWord: String(cfg.wakeWord || ''),
        bargeIn: !!cfg.bargeIn,
        polishBaseUrl: String(cfg.polishBaseUrl || ''),
      })
    },
  }), 'dsh-voice: /status route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-voice/polish',
    handler: async (req, res) => {
      if (req.method !== 'POST') { writeJson(res, 405, { ok: false, error: { code: 'method', message: 'POST only' } }); return }
      const cfg = live()
      let raw
      try { raw = await readBody(req, cfg.maxFileBytes + 1024 * 1024) } catch (e) { writeJson(res, 400, { ok: false, error: { code: 'body', message: e.message } }); return }
      let payload = {}
      try { payload = JSON.parse(raw.toString('utf8') || '{}') } catch { /* пусто */ }
      const text = typeof payload.text === 'string' ? payload.text.trim() : ''
      if (!text) { writeJson(res, 400, { ok: false, error: { code: 'empty', message: 'text required' } }); return }
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
      try {
        const out = await polishText(text, { polish: true }, controller.signal)
        writeJson(res, 200, { ok: true, text: out })
      } catch (e) {
        writeJson(res, 502, { ok: false, error: { code: 'polish', message: String(e && e.message || e) } })
      } finally { clearTimeout(timer) }
    },
  }), 'dsh-voice: /polish route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-voice/transcribe',
    handler: async (req, res) => {
      if (req.method !== 'POST') { writeJson(res, 405, { ok: false, error: { code: 'method', message: 'POST only' } }); return }
      const cfg = live()
      let raw
      try {
        raw = await readBody(req, cfg.maxFileBytes + 1024 * 1024)
      } catch (e) {
        writeJson(res, 400, { ok: false, error: { code: 'body', message: e.message } }); return
      }
      let payload
      try { payload = JSON.parse(raw.toString('utf8') || '{}') } catch { payload = {} }

      const dataBase64 = typeof payload.dataBase64 === 'string' ? payload.dataBase64 : ''
      if (!dataBase64) { writeJson(res, 400, { ok: false, error: { code: 'no-audio', message: 'no audio data' } }); return }
      const mime = typeof payload.mimeType === 'string' && payload.mimeType ? payload.mimeType : 'audio/webm'
      const modeCfg = payload.mode === 'message' ? cfg.message : cfg.dictation

      let bytes
      try { bytes = Buffer.from(dataBase64, 'base64') } catch { bytes = null }
      if (!bytes || bytes.length === 0) {
        writeJson(res, 400, { ok: false, error: { code: 'decode', message: 'failed to decode audio' } }); return
      }
      if (bytes.length > cfg.maxFileBytes) {
        writeJson(res, 413, { ok: false, error: { code: 'too-large', message: `audio is ${bytes.length} bytes, max ${cfg.maxFileBytes}` } }); return
      }

      // Локальный whisper в цепочке — поднимаем сервер заранее, иначе первый
      // же чанк уйдёт в отказ, пока сервер стартует.
      if ((modeCfg.chain || []).some((e) => e.provider === 'local-whisper') && !(await whisperAlive())) {
        await startWhisper()
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
      try {
        const out = await transcribe(modeCfg, bytes, mime, controller.signal)
        // Голосовые команды сессии (#48): чистые «отправь/отмени/стоп/продолжи»
        // не становятся текстом, а возвращаются командой для браузера.
        if (payload.mode === 'message' && modeCfg.sessionCommands === true) {
          const cmd = sessionCommand(out.text)
          if (cmd) { writeJson(res, 200, { ok: true, command: cmd, provider: out.provider, tookMs: out.tookMs }); return }
        }
        const text = await polishText(out.text, modeCfg, controller.signal)
        writeJson(res, 200, { ok: true, text, provider: out.provider, tookMs: out.tookMs })
      } catch (e) {
        writeJson(res, 502, { ok: false, error: { code: 'chain', message: String(e && e.message || e) } })
      } finally {
        clearTimeout(timer)
      }
    },
  }), 'dsh-voice: /transcribe route')

  ctx.tools.register(
    defineTool({
      name: 'transcribe_audio',
      description:
        'Recognize speech in an audio file and return the transcript as text. '
        + 'Uses the voice-message fallback chain from the dsh-voice settings, so a single '
        + 'provider outage or rate limit does not fail the request. '
        + 'Use for voice messages, recordings, interviews.',
      parameters: {
        file_path: { type: 'string', required: true, description: 'Absolute path to the audio file (wav, mp3, m4a, ogg, flac, webm).' },
        language: { type: 'string', description: `Recognition language code. Default: ${baseConfig.message.language}.` },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: { provider: { type: 'string' }, text: { type: 'string' }, tookMs: { type: 'integer' } },
        },
        render(args, value) {
          const body = value.text.length > 4000
            ? `${value.text.slice(0, 4000)}\n…[truncated ${value.text.length} chars]`
            : value.text
          return [{ type: 'text', text: `transcribe_audio (${value.provider}, ${value.tookMs}ms):\n${body}` }]
        },
      },
      isConcurrencySafe: () => false,
      timeoutMs: baseConfig.timeoutMs * 3 + 5000,
      async execute(args, exec) {
        const cfg = live()
        const filePath = String(args.file_path || '').trim()
        if (!filePath) throw new Error('transcribe_audio: file_path is required')
        const info = await stat(filePath).catch(() => null)
        if (!info) throw new Error(`transcribe_audio: file not found: ${filePath}`)
        if (info.size > cfg.maxFileBytes) {
          throw new Error(`transcribe_audio: file too large (${info.size} bytes, max ${cfg.maxFileBytes})`)
        }
        if (info.size < 100) throw new Error('transcribe_audio: file is empty or too small')
        const mime = MIME_BY_EXT[path.extname(filePath).toLowerCase()] || 'audio/wav'
        const bytes = await readFile(filePath)
        const modeCfg = { ...cfg.message, language: String(args.language || cfg.message.language) }
        let raw = await transcribe(modeCfg, bytes, mime, exec.signal)
        if (raw && raw.text) raw = { ...raw, text: await polishText(raw.text, modeCfg, exec.signal) }
        const out = raw
        if (cfg.normalizeTranscript && out && out.text) {
          out.text = normalizePhrase(out.text, {
            digits: true, capSentences: true, commaSpacing: true, trailingPeriod: true,
          })
        }
        return out
      },
    }),
  )

  ctx.effect(() => () => {
    if (child) { try { child.kill && child.kill() } catch { /* уже мёртв */ } }
  }, 'dsh-voice: stop whisper child')
}
