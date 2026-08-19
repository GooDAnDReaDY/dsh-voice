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
import { makeProviders, PROVIDER_KEYS, DEFAULT_MODELS } from './providers.js'
import { toWav16k } from './wav.js'

export const name = 'dsh-voice'
export const inject = ['tools', 'credentials', 'webServer', 'shell']

const ChainEntry = z.object({
  provider: z.string().default('local-whisper')
    .description(`Provider key. One of: ${PROVIDER_KEYS.join(', ')}.`),
  model: z.string().default('')
    .description('Model override. Empty means the provider default.'),
})

export const Config = z.object({
  dictation: z.object({
    chain: z.array(ChainEntry)
      .default([{ provider: 'deepgram', model: '' }, { provider: 'groq', model: '' }, { provider: 'local-whisper', model: '' }])
      .description('Fallback chain for dictation. Speed matters more than accuracy here.'),
    language: z.string().default('ru'),
    vadSilenceMs: z.number().default(700)
      .description('Silence longer than this ends a phrase and sends the chunk.'),
  }).default({}),
  message: z.object({
    chain: z.array(ChainEntry)
      .default([{ provider: 'groq', model: '' }, { provider: 'hf', model: '' }, { provider: 'local-whisper', model: '' }])
      .description('Fallback chain for voice messages. Accuracy matters more than speed.'),
    language: z.string().default('ru'),
    autoSendMs: z.number().default(4000)
      .description('Cancel window before the recognized text is sent to the agent.'),
  }).default({}),
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

export function apply(ctx, config) {
  let child = null

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
      const res = await fetch(config.whisperUrl.split('/inference')[0] + '/', { signal: controller.signal })
      clearTimeout(t)
      return res.ok
    } catch { return false }
  }

  async function startWhisper() {
    if (!config.autoStart) return false
    // Без пути к модели запускать нечего: пакет не знает, где она лежит у
    // конкретного пользователя, и молча стартовать чужой бинарь не должен.
    if (!config.whisperModel) return false
    if (await whisperAlive()) return true
    try {
      const spec = ctx.shell.resolve({
        command: `${JSON.stringify(config.whisperBin)} -m ${JSON.stringify(config.whisperModel)}`
          + ` --host 127.0.0.1 --port 8001 -t 8 -p 1 -l ${config.dictation.language}`,
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
    const models = {}
    const order = []
    for (const entry of Array.isArray(modeCfg.chain) ? modeCfg.chain : []) {
      if (!PROVIDER_KEYS.includes(entry.provider)) continue
      order.push(entry.provider)
      models[entry.provider] = entry.model || DEFAULT_MODELS[entry.provider]
    }
    const providers = makeProviders(
      { resolveKey, fetchImpl: fetch, cfg: config, toWav: (b) => toWav16k(b, config.ffmpegBin) },
      { bytes, mime, lang: modeCfg.language, signal, models },
    )
    return runChain(order, providers)
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-voice/status',
    handler: async (req, res) => {
      if (req.method !== 'GET') { writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET only' } }); return }
      writeJson(res, 200, {
        ok: true,
        whisperRunning: await whisperAlive(),
        modes: {
          dictation: { chain: config.dictation.chain, language: config.dictation.language, vadSilenceMs: config.dictation.vadSilenceMs },
          message: { chain: config.message.chain, language: config.message.language, autoSendMs: config.message.autoSendMs },
        },
      })
    },
  }), 'dsh-voice: /status route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-voice/transcribe',
    handler: async (req, res) => {
      if (req.method !== 'POST') { writeJson(res, 405, { ok: false, error: { code: 'method', message: 'POST only' } }); return }
      let raw
      try {
        raw = await readBody(req, config.maxFileBytes + 1024 * 1024)
      } catch (e) {
        writeJson(res, 400, { ok: false, error: { code: 'body', message: e.message } }); return
      }
      let payload
      try { payload = JSON.parse(raw.toString('utf8') || '{}') } catch { payload = {} }

      const dataBase64 = typeof payload.dataBase64 === 'string' ? payload.dataBase64 : ''
      if (!dataBase64) { writeJson(res, 400, { ok: false, error: { code: 'no-audio', message: 'no audio data' } }); return }
      const mime = typeof payload.mimeType === 'string' && payload.mimeType ? payload.mimeType : 'audio/webm'
      const modeCfg = payload.mode === 'message' ? config.message : config.dictation

      let bytes
      try { bytes = Buffer.from(dataBase64, 'base64') } catch { bytes = null }
      if (!bytes || bytes.length === 0) {
        writeJson(res, 400, { ok: false, error: { code: 'decode', message: 'failed to decode audio' } }); return
      }
      if (bytes.length > config.maxFileBytes) {
        writeJson(res, 413, { ok: false, error: { code: 'too-large', message: `audio is ${bytes.length} bytes, max ${config.maxFileBytes}` } }); return
      }

      // Локальный whisper в цепочке — поднимаем сервер заранее, иначе первый
      // же чанк уйдёт в отказ, пока сервер стартует.
      if ((modeCfg.chain || []).some((e) => e.provider === 'local-whisper') && !(await whisperAlive())) {
        await startWhisper()
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), config.timeoutMs)
      try {
        const out = await transcribe(modeCfg, bytes, mime, controller.signal)
        writeJson(res, 200, { ok: true, text: out.text, provider: out.provider, tookMs: out.tookMs })
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
        language: { type: 'string', description: `Recognition language code. Default: ${config.message.language}.` },
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
      timeoutMs: config.timeoutMs * 3 + 5000,
      async execute(args, exec) {
        const filePath = String(args.file_path || '').trim()
        if (!filePath) throw new Error('transcribe_audio: file_path is required')
        const info = await stat(filePath).catch(() => null)
        if (!info) throw new Error(`transcribe_audio: file not found: ${filePath}`)
        if (info.size > config.maxFileBytes) {
          throw new Error(`transcribe_audio: file too large (${info.size} bytes, max ${config.maxFileBytes})`)
        }
        if (info.size < 100) throw new Error('transcribe_audio: file is empty or too small')
        const mime = MIME_BY_EXT[path.extname(filePath).toLowerCase()] || 'audio/wav'
        const bytes = await readFile(filePath)
        const modeCfg = { ...config.message, language: String(args.language || config.message.language) }
        return transcribe(modeCfg, bytes, mime, exec.signal)
      },
    }),
  )

  ctx.effect(() => () => {
    if (child) { try { child.kill && child.kill() } catch { /* уже мёртв */ } }
  }, 'dsh-voice: stop whisper child')
}
