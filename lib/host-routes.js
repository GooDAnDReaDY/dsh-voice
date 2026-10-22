// HTTP host routes registered on ctx.webServer.
import os from 'node:os'
import { readBody, isLoopback, isTrustedCaller, getVoiceSessionToken, verifyVoiceSessionToken, hasSameOrigin } from './http-util.js'
import { resolveSensevoiceProvider } from './sensevoice-installer.js'
import { applyVoiceMacros } from './macros.js'
import { createSyntheticWav } from './wav.js'
import { handleWsUpgrade } from './ws-framer.js'

function writeJson(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(obj))
}

export function registerHostRoutes(ctx, deps) {
  const {
    live,
    daemons,
    statsTracker,
    transcribe,
    polishText,
    sessionCommand,
    extractVoiceActions,
    applyJargonDictionary,
    KNOWN_KEYS,
  } = deps

  const {
    whisperAlive,
    sensevoiceAlive,
    getWhisperError,
    getSensevoiceError,
    startWhisper,
    startSensevoice,
  } = daemons

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-voice/status',
    handler: async (req, res) => {
      if (req.method !== 'GET') { writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET only' } }); return }
      if (!isTrustedCaller(req)) { writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden source origin' } }); return }
      const cfg = live()
      const whisperOk = await whisperAlive()
      const sensevoiceOk = await sensevoiceAlive()
      const whisperError = whisperOk ? null : getWhisperError()
      const sensevoiceError = sensevoiceOk ? null : getSensevoiceError()
      writeJson(res, 200, {
        ok: true,
        sessionToken: hasSameOrigin(req) ? getVoiceSessionToken() : null,
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
            sessionCommands: cfg.message.sessionCommands, polishSend: cfg.message.polishSend, editablePreview: cfg.message.editablePreview !== false,
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
        dictationMode: cfg.dictationMode || 'clean',
        dictationPrompts: cfg.dictationPrompts || {},
        voiceMacros: Array.isArray(cfg.voiceMacros) ? cfg.voiceMacros : [],
        providerStats: statsTracker.get(),
        recentDiagnostics: typeof statsTracker.getDiagnostics === 'function' ? statsTracker.getDiagnostics() : [],
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
      const subMode = payload.subMode || payload.dictationMode || cfg.dictationMode || 'clean'
      const prompt = typeof payload.prompt === 'string' ? payload.prompt : null
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
      try {
        const out = await polishText(text, { polish: true, subMode, prompt }, controller.signal)
        writeJson(res, 200, { ok: true, text: out, subMode })
      } catch (e) {
        writeJson(res, 502, { ok: false, error: { code: 'polish', message: String(e && e.message || e) } })
      } finally { clearTimeout(timer) }
    },
  }), 'dsh-voice: /polish route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-voice/diagnostics/export',
    handler: async (req, res) => {
      if (req.method !== 'GET') { writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET only' } }); return }
      if (!isTrustedCaller(req)) { writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden source origin' } }); return }
      const report = typeof statsTracker.exportAnonymizedReport === 'function'
        ? statsTracker.exportAnonymizedReport({ version: '0.9.34', environment: 'production' })
        : { summary: statsTracker.get(), recentDiagnostics: [] }
      writeJson(res, 200, { ok: true, report })
    },
  }), 'dsh-voice: /diagnostics/export route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-voice/benchmark',
    handler: async (req, res) => {
      if (req.method !== 'POST') { writeJson(res, 405, { ok: false, error: { code: 'method', message: 'POST only' } }); return }
      if (!isTrustedCaller(req, { loopbackOnly: true })) { writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden source origin' } }); return }

      const cfg = live()
      const effectiveProvider = resolveSensevoiceProvider(cfg)
      const cpus = os.cpus() || []
      const numCores = cpus.length || 1
      const cpuModel = (cpus[0] && cpus[0].model) || 'unknown'
      const platformInfo = `${process.platform}-${process.arch}`
      const isAlive = await sensevoiceAlive()

      if (!isAlive) {
        writeJson(res, 200, {
          ok: true,
          running: false,
          provider: effectiveProvider,
          cpuCores: numCores,
          cpuModel,
          platform: platformInfo,
          message: 'Local ASR server is not running. Hardware detected.',
        })
        return
      }

      const sampleSec = 1.0
      const wavBuf = createSyntheticWav(sampleSec, 16000)
      const tStart = Date.now()
      let latencyMs = 0
      let recognizedText = ''

      try {
        const url = String(cfg.sensevoiceUrl || 'http://127.0.0.1:6006/api/v1/asr').trim()
        const form = new FormData()
        form.append('file', new Blob([wavBuf], { type: 'audio/wav' }), 'benchmark.wav')
        const r = await fetch(url, { method: 'POST', body: form, signal: AbortSignal.timeout(10000) })
        latencyMs = Date.now() - tStart
        if (r.ok) {
          try {
            const data = await r.json()
            recognizedText = String(data?.text || data?.transcript || '').trim()
          } catch { /* json parse error */ }
        }
      } catch {
        latencyMs = Date.now() - tStart
      }

      const rtf = Math.round((latencyMs / (sampleSec * 1000)) * 1000) / 1000
      let rating = 'Fast'
      if (rtf < 0.15) rating = 'Ultra-fast'
      else if (rtf < 0.45) rating = 'Fast'
      else if (rtf <= 1.0) rating = 'Real-time'
      else rating = 'Slow'

      writeJson(res, 200, {
        ok: true,
        running: true,
        provider: effectiveProvider,
        latencyMs,
        rtf,
        sampleSec,
        rating,
        cpuCores: numCores,
        cpuModel,
        platform: platformInfo,
      })
    },
  }), 'dsh-voice: /benchmark route')

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

      const reqStart = Date.now()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
      let out = null
      let polishTookMs = 0
      try {
        out = await transcribe(modeCfg, bytes, mime, controller.signal, payload.contextWords)
        if (payload.mode === 'message' && modeCfg.sessionCommands === true) {
          const cmd = sessionCommand(out.text)
          if (cmd) {
            if (typeof statsTracker.recordDiagnostic === 'function') {
              statsTracker.recordDiagnostic({
                mode: payload.mode || 'dictation',
                subMode: 'command',
                mimeType: mime,
                audioBytes: bytes.length,
                provider: out.provider,
                success: true,
                totalTookMs: Date.now() - reqStart,
                sttMs: out.tookMs || 0,
                vadMs: Number(payload.vadMs) || 0,
              })
            }
            writeJson(res, 200, { ok: true, command: cmd, provider: out.provider, tookMs: out.tookMs }); return
          }
        }
        const subMode = payload.subMode || payload.dictationMode || cfg.dictationMode || 'clean'
        const rawText = out.text
        let text = out.text

        // Dictation modes & polish (#264): verbatim skips LLM entirely (0 LLM calls)
        if (subMode !== 'verbatim' && (modeCfg.polish === true || payload.polish === true)) {
          const polishStart = Date.now()
          text = await polishText(rawText, { ...modeCfg, subMode, prompt: payload.prompt }, controller.signal)
          polishTookMs = Date.now() - polishStart
        }

        // Voice action macros (#167)
        if (Array.isArray(cfg.voiceMacros) && cfg.voiceMacros.length > 0) {
          text = applyVoiceMacros(text, cfg.voiceMacros)
        }

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
        const totalTookMs = Date.now() - reqStart
        if (typeof statsTracker.recordDiagnostic === 'function') {
          statsTracker.recordDiagnostic({
            mode: payload.mode || 'dictation',
            subMode,
            mimeType: mime,
            audioBytes: bytes.length,
            provider: out.provider,
            success: true,
            totalTookMs,
            sttMs: out.tookMs || 0,
            polishMs: polishTookMs,
            vadMs: Number(payload.vadMs) || 0,
            wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
            clipping: Boolean(payload.clipping),
            lowVolume: Boolean(payload.lowVolume),
          })
        }
        writeJson(res, 200, { ok: true, text, rawText, subMode, action, provider: out.provider, tookMs: out.tookMs, polishTookMs, totalTookMs })
      } catch (e) {
        if (typeof statsTracker.recordDiagnostic === 'function') {
          statsTracker.recordDiagnostic({
            mode: payload.mode || 'dictation',
            subMode: payload.subMode || 'clean',
            mimeType: mime,
            audioBytes: bytes.length,
            provider: (out && out.provider) || 'unknown',
            success: false,
            totalTookMs: Date.now() - reqStart,
            vadMs: Number(payload.vadMs) || 0,
            error: String(e && e.message || e),
            clipping: Boolean(payload.clipping),
            lowVolume: Boolean(payload.lowVolume),
          })
        }
        writeJson(res, 502, { ok: false, error: { code: 'chain', message: String(e && e.message || e) } })
      } finally {
        clearTimeout(timer)
      }
    },
  }), 'dsh-voice: /transcribe route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-voice/vad/status',
    handler: async (req, res) => {
      if (!isTrustedCaller(req)) { writeJson(res, 403, { ok: false, error: 'forbidden' }); return }
      writeJson(res, 200, { ok: true, sileroAvailable: true, sampleRate: 16000, frameSamples: 512 })
    },
  }), 'dsh-voice: /dsh-voice/vad/status route')

  if (typeof ctx.webServer.registerUpgrade === 'function') {
    ctx.effect(() => {
      const unreg = ctx.webServer.registerUpgrade({
        path: '/dsh-voice/ws/stream',
        handler: (req, socket, head) => {
          if (!isTrustedCaller(req)) {
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
            socket.destroy()
            return
          }
          const url = new URL(req.url || '/', 'http://127.0.0.1')
          const token = req.headers['x-dsh-voice-token'] || url.searchParams.get('token')
          const expected = getVoiceSessionToken()
          if (!hasSameOrigin(req) && (!token || !verifyVoiceSessionToken(token))) {
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
            socket.destroy()
            return
          }
          if (expected && token && !verifyVoiceSessionToken(token)) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
            socket.destroy()
            return
          }

          handleWsUpgrade(req, socket, head, (ws) => {
            let streamChunks = []
            let streamMime = 'audio/webm'
            let streamMode = 'dictation'
            ws.on('message', async (data, isBinary) => {
              if (isBinary && Buffer.isBuffer(data)) {
                streamChunks.push(data)
              } else if (typeof data === 'string') {
                try {
                  const msg = JSON.parse(data)
                  if (msg.type === 'init') {
                    streamMime = msg.mimeType || 'audio/webm'
                    streamMode = msg.mode || 'dictation'
                    ws.send(JSON.stringify({ type: 'ready' }))
                  } else if (msg.type === 'chunk' && msg.dataBase64) {
                    streamChunks.push(Buffer.from(msg.dataBase64, 'base64'))
                  } else if (msg.type === 'interim') {
                    if (streamChunks.length > 0) {
                      const latestChunk = streamChunks[streamChunks.length - 1]
                      if (latestChunk && latestChunk.length > 3000) {
                        const cfg = live()
                        const baseModeCfg = streamMode === 'message' ? cfg.message : cfg.dictation
                        const LOCAL_ENGINES = new Set(['local-whisper', 'sensevoice', 'browser-webgpu'])
                        const interimChain = (baseModeCfg.chain || []).filter((e) => LOCAL_ENGINES.has(e.provider))

                        let canRunLocal = false
                        for (const entry of interimChain) {
                          if (entry.provider === 'local-whisper' && (await whisperAlive())) { canRunLocal = true; break }
                          if (entry.provider === 'sensevoice' && (await sensevoiceAlive())) { canRunLocal = true; break }
                          if (entry.provider === 'browser-webgpu') { canRunLocal = true; break }
                        }

                        if (canRunLocal && interimChain.length > 0) {
                          const interimModeCfg = { ...baseModeCfg, chain: interimChain, polish: false }
                          const controller = new AbortController()
                          const timer = setTimeout(() => controller.abort(), 5000)
                          try {
                            const interimOut = await transcribe(interimModeCfg, latestChunk, streamMime, controller.signal)
                            if (interimOut && interimOut.text) {
                              ws.send(JSON.stringify({ type: 'interim', text: interimOut.text }))
                            }
                          } catch (err) { /* ignore interim failure */ } finally {
                            clearTimeout(timer)
                          }
                        }
                      }
                    }
                  } else if (msg.type === 'finish') {
                    const buf = Buffer.concat(streamChunks)
                    streamChunks = []
                    if (buf.length < 600) {
                      ws.send(JSON.stringify({ type: 'final', text: '', ok: true }))
                      return
                    }
                    const cfg = live()
                    const modeCfg = streamMode === 'message' ? cfg.message : cfg.dictation
                    const controller = new AbortController()
                    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs || 25000)
                    try {
                      const finalOut = await transcribe(modeCfg, buf, streamMime, controller.signal)
                      let text = finalOut && finalOut.text ? finalOut.text : ''
                      let action = null
                      if (extractVoiceActions && cfg.voiceActions !== false) {
                        const act = extractVoiceActions(text)
                        if (act.action) { action = act.action; text = act.text }
                      }
                      ws.send(JSON.stringify({
                        type: 'final', text, action,
                        provider: finalOut.provider || 'unknown', ok: true,
                      }))
                    } catch (err) {
                      ws.send(JSON.stringify({
                        type: 'error',
                        error: String(err && err.message ? err.message : err), ok: false,
                      }))
                    } finally {
                      clearTimeout(timer)
                    }
                  }
                } catch (err) { /* ignore parse error */ }
              }
            })
          })
        },
      })
      return () => { if (typeof unreg === 'function') unreg() }
    }, 'dsh-voice: /dsh-voice/ws/stream upgrade route')
  }
}
