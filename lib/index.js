// Cordis plugin entrypoint for @goodandready/dsh-voice
// Provides:
//   - Fallback STT chain across cloud and local engines
//   - Volatile config schema for dynamic UI updates
//   - HTTP routes: /dsh-voice/status, /dsh-voice/polish, /dsh-voice/transcribe, /dsh-voice/config
//   - Agent tool: transcribe_audio
//   - Sensevoice installer and self-updater routes

import z from '@deepseek-ai/schemastery'
import { toWav16k } from './wav.js'
import { makeProviders, KNOWN_KEYS, DEFAULT_MODELS } from './providers.js'
import { runChain } from './chain.js'
import { registerSensevoiceInstaller } from './sensevoice-installer.js'
import { registerPluginUpdater } from './updater.js'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { registerConfigRoutes } from './config-routes.js'
import { registerHostRoutes } from './host-routes.js'
import { createConfigReader } from './config-compat.js'
import { createStatsTracker, mergeContextVocabulary } from './stats.js'
import { registerTranscribeAudioTool } from './tool.js'
import { createPolishText } from './polish.js'
import { buildProviderOrder, sessionCommand } from './transcribe-core.js'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { applyJargonDictionary, extractVoiceActions } from './normalize.js'
import { ChainEntry, CustomProvider, BaseConfig } from './schema.js'
import { createLocalDaemons } from './local-daemon.js'

export { ChainEntry, CustomProvider, BaseConfig }
export const name = '@goodandready/dsh-voice'
export const NS = 'dsh-voice'
export const inject = ['tools', 'credentials', 'webServer', 'shell', 'settings', 'llm']

function makeVolatile(schema) {
  if (!schema || typeof schema !== 'object' || !schema.dict) return schema
  const dict = {}
  for (const [k, v] of Object.entries(schema.dict)) {
    dict[k] = (v && typeof v.volatile === 'function') ? v.volatile() : v
  }
  const res = z.object(dict)
  if (typeof schema.description === 'function' && schema.meta?.description) {
    return res.description(schema.meta.description)
  }
  return res
}

export const Config = typeof z.number().volatile === 'function'
  ? makeVolatile(BaseConfig)
  : BaseConfig

export function apply(ctx, baseConfig) {
  let settingsService = null
  let scope = null
  let getConfig = () => baseConfig

  const readEntryConfig = createConfigReader(baseConfig, ctx)
  getConfig = readEntryConfig

  const live = () => BaseConfig(structuredClone(getConfig() ?? {})) ?? readEntryConfig()

  const resolveKey = async (ref) => {
    if (!ref || !ref.type) return ''
    try {
      const resolved = await ctx.credentials.resolve(credentialRef(ref))
      return resolved || ''
    } catch {
      return ''
    }
  }

  const daemons = createLocalDaemons({ live, ctx })
  const { whisperAlive, sensevoiceAlive, startWhisper, startSensevoice } = daemons

  function triggerAutostart() {
    daemons.triggerAutostart()
  }

  ctx.effect(() => () => daemons.dispose(), 'dsh-voice: daemon cleanup')

  ctx.inject(['settings'], (sctx) => {
    settingsService = sctx.settings
    try {
      scope = sctx.settings.register(NS, Config, { base: baseConfig })
      if (scope && typeof scope.get === 'function') {
        getConfig = () => scope.get() ?? readEntryConfig()
      }
      if (scope && typeof scope.watch === 'function') {
        scope.watch(() => {
          triggerAutostart()
        })
      }
    } catch { /* modern DSH handles settings via SettingsForms */ }
    sctx.effect(() => () => { getConfig = readEntryConfig; scope = null; settingsService = null })
    triggerAutostart()
  })

  if (typeof ctx.on === 'function') {
    if (typeof ctx.effect === 'function') {
      ctx.effect(() => ctx.on('loader/volatile-update', () => triggerAutostart()), 'dsh-voice: volatile autostart')
      ctx.effect(() => ctx.on('settings/document-updated', () => triggerAutostart()), 'dsh-voice: settings autostart')
      ctx.effect(() => ctx.on('config', () => triggerAutostart()), 'dsh-voice: config autostart')
    } else {
      ctx.on('loader/volatile-update', () => triggerAutostart())
      ctx.on('settings/document-updated', () => triggerAutostart())
      ctx.on('config', () => triggerAutostart())
    }
  }

  triggerAutostart()

  const statsTracker = createStatsTracker()

  async function transcribe(modeCfg, bytes, mime, signal, contextWords) {
    const cfg = live()
    const customKeys = (Array.isArray(cfg.customProviders) ? cfg.customProviders : [])
      .map((c) => String(c && c.key || '').trim()).filter(Boolean)
    const { order, models } = buildProviderOrder({
      localOnly: !!cfg.localOnly,
      chain: modeCfg.chain,
      customKeys,
      knownKeys: KNOWN_KEYS,
      defaultModels: DEFAULT_MODELS,
    })

    const vocab = cfg.contextGlossary
      ? mergeContextVocabulary(cfg.vocabulary, contextWords)
      : (Array.isArray(cfg.vocabulary) ? cfg.vocabulary : [])

    const providers = makeProviders(
      { resolveKey, fetchImpl: fetch, cfg, toWav: (b, sig) => toWav16k(b, cfg.ffmpegBin, sig || signal) },
      { bytes, mime, lang: modeCfg.language, signal, models, vocabulary: vocab },
    )
    return runChain(order, providers, statsTracker.record)
  }

  const polishText = createPolishText({
    resolveKey,
    fetchImpl: (...args) => fetch(...args),
    getConfig: live,
    llm: ctx.llm,
    createUserMessage,
    getAgentDefaultModel: () => (ctx.get && ctx.get('agentDefaultModel')?.currentSelection)
      ? ctx.get('agentDefaultModel').currentSelection()
      : null,
  })

  registerHostRoutes(ctx, {
    live,
    daemons,
    statsTracker,
    transcribe,
    polishText,
    sessionCommand,
    extractVoiceActions,
    applyJargonDictionary,
    KNOWN_KEYS,
  })

  // Registers agent tool name: 'transcribe_audio'
  ctx.effect(() => registerTranscribeAudioTool(ctx, {
    live,
    baseConfig,
    transcribe,
    polishText,
  }), 'dsh-voice: transcribe_audio tool')

  ctx.effect(() => registerPluginUpdater(ctx, {
    endpoint: '/api/dsh-voice/update',
    packageName: '@goodandready/dsh-voice',
    manifestUrl: new URL('../package.json', import.meta.url),
  }), 'dsh-voice: updater route')

  ctx.effect(() => registerSensevoiceInstaller(ctx, {
    liveConfig: live,
    isAlive: sensevoiceAlive,
    updateConfig: async (patch) => {
      const merged = { ...live(), ...patch }
      if (settingsService) {
        let rev
        try { rev = settingsService.describe?.()?.find?.((r) => r.ns === NS)?.revision } catch {}
        if (typeof settingsService.replace === 'function') await settingsService.replace(NS, merged, rev)
        else if (typeof settingsService.update === 'function') await settingsService.update(NS, merged, rev)
      } else if (scope) {
        if (typeof scope.replace === 'function') await scope.replace(merged)
        else if (typeof scope.patch === 'function') await scope.patch(merged)
        else if (typeof scope.set === 'function') {
          for (const [k, v] of Object.entries(merged)) await scope.set(k, v).catch(() => {})
        }
      }
    },
    startSensevoice,
  }), 'dsh-voice: sensevoice installer route')

  ctx.effect(() => registerConfigRoutes(ctx, {
    NS,
    live,
    getSettingsService: () => settingsService,
    getScope: () => scope,
    validateConfig: (val) => BaseConfig(structuredClone(val)),
    triggerAutostart,
  }), 'dsh-voice: config route')
}
