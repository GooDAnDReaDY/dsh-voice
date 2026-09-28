import { defineTool } from '@deepseek-ai/dsh-tools'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { getAllowedAudioRoots, validateAudioPath, validateAudioContent } from './audio-guard.js'
import { normalizePhrase } from './normalize.js'

export const MIME_BY_EXT = {
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.mp4': 'audio/mp4',
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.flac': 'audio/flac', '.webm': 'audio/webm', '.aac': 'audio/aac',
}

export function registerTranscribeAudioTool(ctx, { live, baseConfig, transcribe, polishText }) {
  return ctx.tools.register(
    defineTool({
      name: 'transcribe_audio',
      description:
        'Recognize speech in an audio file and return the transcript as text. '
        + 'Uses the voice-message fallback chain from the dsh-voice settings, so a single '
        + 'provider outage or rate limit does not fail the request. '
        + 'Use for voice messages, recordings, interviews.',
      parameters: {
        file_path: { type: 'string', required: true, description: 'Absolute path to the audio file (wav, mp3, m4a, ogg, flac, webm).' },
        language: { type: 'string', description: `Recognition language code (e.g. "en", "ru", "zh", or empty string for auto-detection). Default: ${(baseConfig && baseConfig.message && baseConfig.message.language) || 'auto'}.` },
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
      timeoutMs: 365000,
      async execute(args, exec) {
        const cfg = live()
        const filePath = String(args.file_path || '').trim()
        if (!filePath) throw new Error('transcribe_audio: file_path is required')
        const allowedRoots = getAllowedAudioRoots(cfg)
        const { real } = await validateAudioPath(filePath, allowedRoots)
        const info = await stat(real).catch(() => null)
        if (!info) throw new Error(`transcribe_audio: file not found: ${filePath}`)
        if (info.size > cfg.maxFileBytes) {
          throw new Error(`transcribe_audio: file too large (${info.size} bytes, max ${cfg.maxFileBytes})`)
        }
        if (info.size < 44) throw new Error('transcribe_audio: file is empty or too small')
        const bytes = await readFile(real)
        const sniffedMime = validateAudioContent(bytes)
        const mime = sniffedMime || MIME_BY_EXT[path.extname(real).toLowerCase()] || 'audio/wav'
        const modeCfg = { ...cfg.message, language: String(args.language !== undefined ? args.language : cfg.message.language) }
        let raw = await transcribe(modeCfg, bytes, mime, exec.signal)
        if (raw && raw.text) raw = { ...raw, text: await polishText(raw.text, modeCfg, exec.signal) }
        const out = raw
        if (cfg.normalizeTranscript && out && out.text) {
          out.text = normalizePhrase(out.text, {
            lang: modeCfg.language,
            digits: true, capSentences: true, commaSpacing: true, trailingPeriod: true,
          })
        }
        return out
      },
    }),
  )
}
