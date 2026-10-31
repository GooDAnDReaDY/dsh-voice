// Subsystem for transcription pipeline, LLM polish, and agent tool registration (#304)
import { toWav16k } from './wav.js'
import { makeProviders, KNOWN_KEYS, DEFAULT_MODELS } from './providers.js'
import { runChain } from './chain.js'
import { buildTranscriptionPrompt, buildProviderOrder } from './transcribe-core.js'
import { registerTranscribeAudioTool } from './tool.js'
import { createPolishText } from './polish.js'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { credentialRef } from '@deepseek-ai/dsh-credentials'

export function createSecretResolver(ctx) {
  return async (ref) => {
    if (!ref || typeof ref !== 'string') return ''
    try {
      const resolved = await ctx.credentials.resolve(credentialRef(ref))
      return (typeof resolved === 'string' ? resolved : resolved?.value) || ''
    } catch {
      return ''
    }
  }
}

export function createServerPipeline({ ctx, live, statsTracker, fetchImpl = (...args) => fetch(...args) }) {
  const resolveKey = createSecretResolver(ctx)

  async function transcribe(modeCfg, bytes, mime, signal, contextWords) {
    const cfg = live()
    const customKeys = (Array.isArray(cfg.customProviders) ? cfg.customProviders : [])
      .map((c) => String((c && c.key) || '').trim()).filter(Boolean)
    const { order, models } = buildProviderOrder({
      localOnly: !!cfg.localOnly,
      chain: modeCfg.chain,
      customKeys,
      knownKeys: KNOWN_KEYS,
      defaultModels: DEFAULT_MODELS,
    })

    const { promptText, keywords, vocabulary: vocab } = buildTranscriptionPrompt({
      vocabulary: cfg.vocabulary,
      contextWords: cfg.contextGlossary ? contextWords : [],
      bilingualDeveloperPrompt: cfg.bilingualDeveloperPrompt !== false,
      bilingualCustomPrompt: cfg.bilingualCustomPrompt || '',
      language: modeCfg.language,
    })

    const providers = makeProviders(
      { resolveKey, fetchImpl, cfg, toWav: (b, sig) => toWav16k(b, cfg.ffmpegBin, sig || signal) },
      { bytes, mime, lang: modeCfg.language, signal, models, vocabulary: vocab, promptText, keywords },
    )
    return runChain(order, providers, statsTracker.record)
  }

  const polishText = createPolishText({
    resolveKey,
    fetchImpl,
    getConfig: live,
    llm: ctx.llm,
    createUserMessage,
    getAgentDefaultModel: () => (ctx.get && ctx.get('agentDefaultModel')?.currentSelection)
      ? ctx.get('agentDefaultModel').currentSelection()
      : null,
  })

  return { resolveKey, transcribe, polishText }
}

export function registerServerTools(ctx, { live, baseConfig, transcribe, polishText }) {
  ctx.effect(() => registerTranscribeAudioTool(ctx, {
    live,
    baseConfig,
    transcribe,
    polishText,
  }), 'dsh-voice: transcribe_audio tool')
}
