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
  const source = localOnly
    ? (chain || []).filter((e) => e && e.provider === 'local-whisper')
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
    throw new Error('localOnly mode is on, but local-whisper is not in the chain')
  }
  return { order, models }
}

const SESSION_COMMANDS = [
  { re: /^(отправь|отправить|пошли|send)\s*[.!?]*$/i, cmd: 'send' },
  { re: /^(отмени|отмена|cancel|отменить)\s*[.!?]*$/i, cmd: 'cancel' },
  { re: /^(стоп|stop|хватит)\s*[.!?]*$/i, cmd: 'stop' },
  { re: /^(продолжи|continue|продолжай)\s*[.!?]*$/i, cmd: 'continue' },
]

/**
 * @param {string} text
 * @returns {'send'|'cancel'|'stop'|'continue'|null}
 */
export function sessionCommand(text) {
  const t = String(text || '').trim().toLowerCase()
  if (!t) return null
  for (const { re, cmd } of SESSION_COMMANDS) {
    if (re.test(t)) return cmd
  }
  return null
}