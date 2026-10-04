// lib/host-routes.js — Host HTTP routes for dsh-voice status, polish, and transcribe
import { writeJson, readBody, isTrustedCaller } from './http-util.js'
import { resolveSensevoiceProvider } from './sensevoice-installer.js'

export function registerHostRoutes(ctx, {
  live,
  daemons,
  statsTracker,
  transcribe,
  polishText,
  sessionCommand,
  extractVoiceActions,
  applyJargonDictionary,
  KNOWN_KEYS,
}) {
  const { whisperAlive, sensevoiceAlive, getWhisperError, getSensevoiceError, startWhisper, startSensevoice } = daemons

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-voice/status',
    handler: async (req, res) => {
      if (req.method !== 'GET') { writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET only' } }); return }
      const cfg = live()
      const whisperOk = await whisperAlive()
      const sensevoiceOk = await sensevoiceAlive()
      const whisperError = whisperOk ? null : getWhisperError()
      const sensevoiceError = sensevoiceOk ? null : getSensevoiceError()
      writeJson(res, 200, {
        ok: true,
        whisperRunning: whisperOk,
        whisperError: whisperOk ? null : whisperError,
        sensevoiceRunning: sensevoiceOk,
        sensevoiceError: sensevoiceOk ? null : sensevoiceError,
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
        sensevoiceProvider: cfg.sensevoiceProvider || 'cpu',
        effectiveSensevoiceProvider: resolveSensevoiceProvider(cfg),
        sensevoiceThreads: cfg.sensevoiceThreads || 4,
        webgpuModel: cfg.webgpuModel || 'onnx-community/whisper-tiny',
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
      try { raw = await readBody(req, 1024 * 1024) } catch (e) {
        if (e && (e.statusCode === 413 || e.message === 'body too large')) {
          writeJson(res, 413, { ok: false, error: { code: 'too-large', message: 'body exceeds limit of 1MB' } })
          return
        }
        writeJson(res, 400, { ok: false, error: { code: 'body', message: e.message } })
        return
      }
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
      const baseModeCfg = payload.mode === 'message' ? cfg.message : cfg.dictation
      const modeCfg = Array.isArray(payload.chain)
        ? { ...baseModeCfg, chain: payload.chain }
        : baseModeCfg

      let bytes
      try { bytes = Buffer.from(dataBase64, 'base64') } catch { bytes = null }
      if (!bytes || bytes.length === 0) {
        writeJson(res, 400, { ok: false, error: { code: 'decode', message: 'failed to decode audio' } }); return
      }
      if (bytes.length > cfg.maxFileBytes) {
        writeJson(res, 413, { ok: false, error: { code: 'too-large', message: `audio is ${bytes.length} bytes, max ${cfg.maxFileBytes}` } }); return
      }

      if ((modeCfg.chain || []).some((e) => e.provider === 'local-whisper') && !(await whisperAlive())) {
        await startWhisper()
      }
      if ((modeCfg.chain || []).some((e) => e.provider === 'sensevoice') && !(await sensevoiceAlive())) {
        await startSensevoice()
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
      try {
        const out = await transcribe(modeCfg, bytes, mime, controller.signal, payload.contextWords)
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
}
