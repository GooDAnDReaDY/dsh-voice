// dsh-voice — host half.
//
// Two voice input modes, each with its own provider fallback chain:
//   dictation — the browser cuts speech on pauses and posts chunks; text is
//               appended to the composer;
//   message   — one whole recording; text is sent after the cancel window.
//
// Routes:
//   POST /dsh-voice/transcribe  {dataBase64, mimeType, mode} -> {ok, text, provider, tookMs}
//   GET  /dsh-voice/status      -> {ok, whisperRunning, modes}
//
// Provider keys are resolved on the host via ctx.credentials and never reach
// the browser.

import z from "@deepseek-ai/schemastery"
import { credentialRef } from "@deepseek-ai/dsh-credentials"
import path from "node:path"
import { runChain } from "./chain.js"
import { makeProviders, KNOWN_KEYS, DEFAULT_MODELS } from "./providers.js"
import { toWav16k } from "./wav.js"
import { applyJargonDictionary, extractVoiceActions } from "./normalize.js"
import { createStatsTracker, mergeContextVocabulary } from "./stats.js"
import { writeJson, readBody, isTrustedCaller } from "./http-util.js"
import { createPolishText } from "./polish.js"
import { createUserMessage } from "@deepseek-ai/dsh-llm"
import { buildProviderOrder, sessionCommand } from "./transcribe-core.js"
import { registerPluginUpdater } from "./updater.js"
import { registerSensevoiceInstaller, findTokensFile } from "./sensevoice-installer.js"
import { createConfigReader } from "./config-compat.js"
import { registerConfigRoutes } from "./config-routes.js"
import { isAutoLang } from "./provider-http.js"
import { ChainEntry, CustomProvider, BaseConfig } from "./schema.js"
import { registerTranscribeAudioTool } from "./tool.js"
export { ChainEntry, CustomProvider, BaseConfig }

export const name = '@goodandready/dsh-voice'
export const NS = 'dsh-voice'
export const inject = ['tools', 'credentials', 'webServer', 'shell', 'settings', 'llm']

function makeVolatile(schema) {
  if (!schema || typeof schema.volatile !== 'function') return schema
  if (schema.type === 'object' && schema.dict) {
    const dict = {}
    for (const [k, v] of Object.entries(schema.dict)) {
      dict[k] = makeVolatile(v)
    }
    const res = z.object(dict)
    if (schema.meta) Object.assign(res.meta, schema.meta)
    return res
  }
  return schema.volatile()
}

export const Config = typeof z.number().volatile === 'function'
  ? makeVolatile(BaseConfig)
  : BaseConfig

export function apply(ctx, baseConfig) {
  let child = null

  // The settings card edits a namespace named after the plugin.
  // Using createConfigReader decodes volatile nodes on modern DSH cores
  // while caching unwrapped values across requests.
  const readEntryConfig = createConfigReader(baseConfig, ctx)
  let scope = null
  let settingsService = null
  let getConfig = readEntryConfig
  const live = () => BaseConfig(structuredClone(getConfig() ?? {})) ?? readEntryConfig()

  async function resolveKey(ref) {
    try {
      const resolved = await ctx.credentials.resolve(credentialRef(ref))
      if (resolved && resolved.value) return resolved.value
    } catch { /* fall through to environment */ }
    return process.env[ref] || ''
  }

  async function whisperAlive() {
    const rawUrl = String(live().whisperUrl || '').trim()
    const base = rawUrl.includes('/inference') ? rawUrl.split('/inference')[0] : rawUrl.replace(/\/+$/, '')
    if (!base) return false
    try {
      const res = await fetch(base + '/', { signal: AbortSignal.timeout(2000) })
      return res.ok
    } catch {
      return false
    }
  }

  let whisperError = null
  let startingWhisper = false
  async function startWhisper() {
    if (startingWhisper) return false
    startingWhisper = true
    const cfg = live()
    if (!cfg.autoStart) return false
    // Without a model path there is nothing to start: the package cannot know
    // where a user's model lives and must not launch a random binary.
    if (!cfg.whisperModel) return false
    if (await whisperAlive()) {
      whisperError = null
      return true
    }
    try {
      if (child && typeof child.kill === 'function') {
        try { child.kill() } catch { /* ignore */ }
        child = null
      }
      const spec = ctx.shell.resolve({
        command: `${JSON.stringify(cfg.whisperBin)} -m ${JSON.stringify(cfg.whisperModel)}`
          + ` --host 127.0.0.1 --port 8001 -t 8 -p 1 -l ${isAutoLang(cfg.dictation.language) ? 'auto' : cfg.dictation.language}`,
        timeoutMs: 0,
        stdoutMaxBytes: 4 * 1024 * 1024,
      })
      child = ctx.shell.start(spec)
      if (child && typeof child.on === 'function') {
        child.on('error', (err) => {
          whisperError = err?.message || String(err)
        })
        child.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            whisperError = `whisper server process exited with code ${code}`
          }
        })
      }
      // Wait for it to become healthy (up to 30s for cold model loading on Metal/CPU).
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 500))
        if (await whisperAlive()) {
          whisperError = null
          return true
        }
        if (child && child.exitCode !== null && child.exitCode !== undefined) {
          whisperError = `whisper server process exited prematurely with code ${child.exitCode}`
          return false
        }
      }
      whisperError = 'whisper server process started but failed health check on port 8001'
      return false
    } catch (err) {
      whisperError = String(err && err.message ? err.message : err)
      return false
    }
    finally { startingWhisper = false }
  }

  // SenseVoice-ONNX / Sherpa-ONNX: autostart and health check.
  let sensevoiceChild = null
  let sensevoiceError = null

  async function sensevoiceAlive() {
    const cfg = live()
    const base = String(cfg.sensevoiceUrl || '').replace(/\/api\/.*$/, '').replace(/\/v1\/.*$/, '').replace(/\/+$/, '')
    if (!base) return false
    try {
      const res = await fetch(base + '/', { signal: AbortSignal.timeout(2000) })
      return res.ok || res.status === 404 // sherpa-onnx answers 404 on / but is alive
    } catch {
      return false
    }
  }

  let startingSensevoice = false
  async function startSensevoice() {
    if (startingSensevoice) return false
    startingSensevoice = true
    const cfg = live()
    if (!cfg.sensevoiceAutostart) return false
    if (!cfg.sensevoiceModel) return false
    if (await sensevoiceAlive()) {
      sensevoiceError = null
      return true
    }
    try {
      if (sensevoiceChild && typeof sensevoiceChild.kill === 'function') {
        try { sensevoiceChild.kill() } catch { /* ignore */ }
        sensevoiceChild = null
      }
      let port = '6006'
      try { port = new URL(cfg.sensevoiceUrl).port || '6006' } catch { /* invalid URL */ }
      const tokensPath = findTokensFile(path.dirname(cfg.sensevoiceModel))
      const tokensArg = tokensPath ? ` --tokens=${JSON.stringify(tokensPath)}` : ''
      const spec = ctx.shell.resolve({
        command: `${JSON.stringify(cfg.sensevoiceBin)}`
          + ` --sense-voice-model=${JSON.stringify(cfg.sensevoiceModel)}`
          + tokensArg
          + ` --port=${port} --num-threads=4`,
        timeoutMs: 0,
        stdoutMaxBytes: 4 * 1024 * 1024,
      })
      sensevoiceChild = ctx.shell.start(spec)
      if (sensevoiceChild && typeof sensevoiceChild.on === 'function') {
        sensevoiceChild.on('error', (err) => {
          sensevoiceError = err?.message || String(err)
        })
        sensevoiceChild.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            sensevoiceError = `sensevoice process exited with code ${code}`
          }
        })
      }
      // Wait for it to become healthy (up to 30s).
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 500))
        if (await sensevoiceAlive()) {
          sensevoiceError = null
          return true
        }
        if (sensevoiceChild && sensevoiceChild.exitCode !== null && sensevoiceChild.exitCode !== undefined) {
          sensevoiceError = `sensevoice process exited prematurely with code ${sensevoiceChild.exitCode}`
          return false
        }
      }
      sensevoiceError = 'sensevoice process started but failed health check'
      return false
    } catch (err) {
      sensevoiceError = String(err && err.message ? err.message : err)
      return false
    }
    finally { startingSensevoice = false }
  }

  function triggerAutostart() {
    startWhisper().catch((err) => {
      ctx.logger?.debug?.('whisper autostart failed: %s', err?.message || err)
    })
    startSensevoice().catch((err) => {
      ctx.logger?.debug?.('sensevoice autostart failed: %s', err?.message || err)
    })
  }

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

  if (typeof ctx.on === "function") {
    if (typeof ctx.effect === "function") {
      ctx.effect(() => ctx.on('loader/volatile-update', () => triggerAutostart()), "dsh-voice: volatile autostart")
      ctx.effect(() => ctx.on('settings/document-updated', () => triggerAutostart()), "dsh-voice: settings autostart")
      ctx.effect(() => ctx.on('config', () => triggerAutostart()), "dsh-voice: config autostart")
    } else {
      ctx.on('loader/volatile-update', () => triggerAutostart())
      ctx.on('settings/document-updated', () => triggerAutostart())
      ctx.on('config', () => triggerAutostart())
    }
  }

  triggerAutostart()

  // Provider health and latency stats (Latency & Health Dashboard).
  const statsTracker = createStatsTracker()

  // Shared recognition path: build providers from the mode chain and run it.
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

  // Transcript polish (#35) with local LLM support (#47).
  // Errors/timeouts do not block: return the raw text.
  const polishText = createPolishText({
    resolveKey,
    fetchImpl: (...args) => fetch(...args),
    getConfig: live,
    llm: ctx.llm,
    createUserMessage,
    getAgentDefaultModel: () => (ctx.get && ctx.get('agentDefaultModel') && ctx.get('agentDefaultModel').currentSelection)
      ? ctx.get('agentDefaultModel').currentSelection()
      : null,
  })

  // sessionCommand imported from ./transcribe-core.js

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-voice/status',
    handler: async (req, res) => {
      if (req.method !== 'GET') { writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET only' } }); return }
      const cfg = live()
      const whisperOk = await whisperAlive()
      const sensevoiceOk = await sensevoiceAlive()
      writeJson(res, 200, {
        ok: true,
        whisperRunning: whisperOk,
        whisperError: whisperOk ? null : whisperError,
        sensevoiceRunning: sensevoiceOk,
        sensevoiceError: sensevoiceOk ? null : sensevoiceError,
        // The hotkey is needed by the browser half: it installs the hold handler.
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
        noiseGateDb: cfg.noiseGateDb !== undefined ? cfg.noiseGateDb : -45,
        historyLimit: cfg.historyLimit,
        voiceCommands: cfg.voiceCommands,
        wakeWord: String(cfg.wakeWord || ''),
        bargeIn: !!cfg.bargeIn,
        polishBaseUrl: String(cfg.polishBaseUrl || ''),
        noiseSuppression: cfg.noiseSuppression !== false,
        contextGlossary: cfg.contextGlossary !== false,
        sensevoiceUrl: cfg.sensevoiceUrl,
        sensevoiceAutostart: !!cfg.sensevoiceAutostart,
        deepgramBaseUrl: cfg.deepgramBaseUrl || 'https://api.deepgram.com',
        visualizerStyle: cfg.visualizerStyle || 'liquid-wave',
        gatedTurnTaking: cfg.gatedTurnTaking !== false,
        autoSendVisualRing: cfg.autoSendVisualRing !== false,
        voiceActions: cfg.voiceActions !== false,
        techJargonCorrection: cfg.techJargonCorrection !== false,
        jargonDictionary: Array.isArray(cfg.jargonDictionary) ? cfg.jargonDictionary : [],
        liveInterimPreview: cfg.liveInterimPreview !== false,
        structuredPromptVoice: cfg.structuredPromptVoice !== false,
        providerStats: statsTracker.get(),
      })
    },
  }), 'dsh-voice: /status route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-voice/polish',
    handler: async (req, res) => {
      if (req.method !== 'POST') { writeJson(res, 405, { ok: false, error: { code: 'method', message: 'POST only' } }); return }
      if (!isTrustedCaller(req)) { writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden source origin' } }); return }
      const cfg = live()
      let raw
      try { raw = await readBody(req, 1024 * 1024) } catch (e) { writeJson(res, 400, { ok: false, error: { code: 'body', message: e.message } }); return }
      let payload = {}
      try { payload = JSON.parse(raw.toString('utf8') || '{}') } catch { /* empty */ }
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
      if (!isTrustedCaller(req)) { writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden source origin' } }); return }
      const cfg = live()
      const maxBodyBytes = Math.ceil((cfg.maxFileBytes * 4) / 3) + 64 * 1024
      let raw
      try {
        raw = await readBody(req, maxBodyBytes)
      } catch (e) {
        if (e && e.message === 'body too large') {
          writeJson(res, 413, { ok: false, error: { code: 'too-large', message: `audio body exceeds limit for max ${cfg.maxFileBytes} bytes` } })
          return
        }
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

      // Local whisper in the chain — start the server up front, otherwise the
      // first chunk fails while the server is still booting.
      if ((modeCfg.chain || []).some((e) => e.provider === 'local-whisper') && !(await whisperAlive())) {
        await startWhisper()
      }
      // Same for SenseVoice-ONNX / Sherpa-ONNX.
      if ((modeCfg.chain || []).some((e) => e.provider === 'sensevoice') && !(await sensevoiceAlive())) {
        await startSensevoice()
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
      try {
        const out = await transcribe(modeCfg, bytes, mime, controller.signal, payload.contextWords)
        // Session voice commands (#48): clean "send/cancel/stop/continue"
        // become a command for the browser instead of composer text.
        if (payload.mode === 'message' && modeCfg.sessionCommands === true) {
          const cmd = sessionCommand(out.text)
          if (cmd) { writeJson(res, 200, { ok: true, command: cmd, provider: out.provider, tookMs: out.tookMs }); return }
        }
        let text = await polishText(out.text, modeCfg, controller.signal)
        if (cfg.techJargonCorrection !== false) {
          text = applyJargonDictionary(text, cfg.jargonDictionary)
        }
        let action = null
        if (cfg.voiceActions !== false) {
          const actionRes = extractVoiceActions(text)
          if (actionRes.action) {
            text = actionRes.text
            action = actionRes.action
          }
        }
        writeJson(res, 200, { ok: true, text, action, provider: out.provider, tookMs: out.tookMs })
      } catch (e) {
        writeJson(res, 502, { ok: false, error: { code: 'chain', message: String(e && e.message || e) } })
      } finally {
        clearTimeout(timer)
      }
    },
  }), 'dsh-voice: /transcribe route')

  // Registers agent tool name: 'transcribe_audio'
  ctx.effect(() => registerTranscribeAudioTool(ctx, {
    live,
    baseConfig,
    transcribe,
    polishText,
  }), 'dsh-voice: transcribe_audio tool')

  ctx.effect(() => () => {
    if (child) { try { child.kill && child.kill() } catch { /* already dead */ } }
    if (sensevoiceChild) { try { sensevoiceChild.kill && sensevoiceChild.kill() } catch { /* already dead */ } }
  }, 'dsh-voice: stop child processes')

  ctx.effect(() => registerPluginUpdater(ctx, {
    endpoint: '/api/dsh-voice/update',
    packageName: '@goodandready/dsh-voice',
    manifestUrl: new URL('../package.json', import.meta.url),
  }), 'dsh-voice: updater route')

  ctx.effect(() => registerSensevoiceInstaller(ctx, {
    liveConfig: live,
    isAlive: sensevoiceAlive,
    updateConfig: async (patch) => {
      if (scope && typeof scope.patch === 'function') {
        scope.patch(patch)
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

