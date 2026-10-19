import { mergeContextVocabulary } from './stats.js'
// Pure helpers for the transcribe path: chain selection and session commands.

/**
 * Build provider order for a mode, honouring localOnly.
 * @param {object} args
 * @param {boolean} args.localOnly
 * @param {{provider: string, model?: string}[]} args.chain
 * @param {string[]} args.customKeys
 * @param {string[]} args.knownKeys
 * @param {Record<string, string>} args.defaultModels
 * @returns {{order: string[], models: Record<string, string>}}
 */
export function buildProviderOrder({ localOnly, chain, customKeys, knownKeys, defaultModels }) {
  const localEngines = new Set(['local-whisper', 'sensevoice', 'browser-webgpu'])
  const source = localOnly
    ? (chain || []).filter((e) => e && localEngines.has(e.provider))
    : (chain || [])
  const models = {}
  const order = []
  for (const entry of source) {
    if (!entry || !entry.provider) continue
    if (!knownKeys.includes(entry.provider) && !customKeys.includes(entry.provider)) continue
    order.push(entry.provider)
    models[entry.provider] = entry.model || defaultModels[entry.provider] || ''
  }
  if (localOnly && order.length === 0) {
    throw new Error('localOnly mode is on, but no local engine (local-whisper or sensevoice) is in the chain')
  }
  return { order, models }
}

const SESSION_COMMANDS = [
  { re: /^(отправь|отправить|пошли|send|发送|发出去)\s*[.!?]*$/i, cmd: 'send' },
  { re: /^(отмени|отмена|cancel|отменить|取消|算了)\s*[.!?]*$/i, cmd: 'cancel' },
  { re: /^(стоп|stop|хватит|停止|暂停)\s*[.!?]*$/i, cmd: 'stop' },
  { re: /^(продолжи|continue|продолжай|继续)\s*[.!?]*$/i, cmd: 'continue' },
  { re: /^(отмени последнее|сотри последнее|удали последнее|откати последнее|undo|undo last|undo chunk|撤销|撤销上一句)\s*[.!?]*$/i, cmd: 'undo_chunk' },
]

/**
 * @param {string} text
 * @returns {'send'|'cancel'|'stop'|'continue'|'undo_chunk'|null}
 */
export function sessionCommand(text) {
  const t = String(text || '').trim().toLowerCase()
  if (!t) return null
  for (const { re, cmd } of SESSION_COMMANDS) {
    if (re.test(t)) return cmd
  }
  return null
}

export const DEFAULT_BILINGUAL_PROMPT = 'TypeScript, Python, JavaScript, Docker, Git commit, PR, push, merge, branch, npm, pnpm, API, JSON, async, await, bug, deploy, Linux, bash. Смешанная речь разработчика: русский язык с английскими терминами, командами и кодом.'

export function buildTranscriptionPrompt({
  vocabulary = [],
  contextWords = [],
  bilingualDeveloperPrompt = true,
  bilingualCustomPrompt = '',
  language = 'ru',
  maxWords = 50,
} = {}) {
  const mergedVocab = mergeContextVocabulary(vocabulary, contextWords, maxWords)
  const isRuOrAuto = !language || language === 'ru' || language === 'auto'
  let primer = ''
  if (bilingualDeveloperPrompt && isRuOrAuto) {
    primer = (typeof bilingualCustomPrompt === 'string' && bilingualCustomPrompt.trim())
      ? bilingualCustomPrompt.trim()
      : DEFAULT_BILINGUAL_PROMPT
  }
  const vocabStr = mergedVocab.join(', ')
  let promptText = ''
  if (primer && vocabStr) {
    promptText = `${primer} Термины: ${vocabStr}.`
  } else if (primer) {
    promptText = primer
  } else {
    promptText = vocabStr
  }

  const keywords = [...mergedVocab]
  if (bilingualDeveloperPrompt && isRuOrAuto) {
    for (const w of ['Docker', 'Git', 'commit', 'PR', 'merge', 'branch', 'pnpm', 'npm', 'API', 'JSON', 'TypeScript']) {
      if (!keywords.includes(w)) keywords.push(w)
    }
  }

  return {
    vocabulary: mergedVocab,
    promptText: promptText.trim(),
    keywords: keywords.slice(0, maxWords).join(', '),
  }
}
