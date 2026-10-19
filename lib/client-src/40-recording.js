voice._chainsPromise = null
    function modeChain(mode) {
      if (!voice._chainsPromise) {
        voice._chainsPromise = fetch('/dsh-voice/status', { cache: 'no-store' })
          .then((res) => res.json())
          .then((data) => {
            if (data && typeof data.localOnly === 'boolean') {
              voice.settings.localOnly = data.localOnly
            }
            if (data && data.webgpuModel) {
              voice.settings.webgpuModel = data.webgpuModel
            }
            return (data && data.modes) || {}
          })
          .catch(() => {
            voice._chainsPromise = null
            return {}
          })
      }
      return voice._chainsPromise.then((modes) => {
        const row = modes[mode] || {}
        let chain = Array.isArray(row.chain) ? row.chain : []
        let providers = chain.map((e) => (typeof e === 'string' ? e : e && e.provider)).filter(Boolean)
        if (voice.settings && voice.settings.localOnly) {
          providers = providers.filter((p) => p !== 'browser')
        }
        const modelMap = {}
        for (const entry of chain) {
          if (entry && entry.provider && entry.model) {
            modelMap[entry.provider] = entry.model
          }
        }
        return {
          chain: providers,
          language: row.language !== undefined ? row.language : '',
          modelMap,
        }
      })
    }
    // ------------------------------------------------------------ recording
    function teardown(rec) {
      if (!rec) return
      if (rec.wsStream) { try { rec.wsStream.close() } catch (_) {} rec.wsStream = null }
      try { rec.stream.getTracks().forEach((t) => t.stop()) } catch (e) { /* already stopped */ }
      if (rec.srcNode) { try { rec.srcNode.disconnect() } catch (e) { /* already disconnected */ } }
      if (rec.filterNode) { try { rec.filterNode.disconnect() } catch (e) { /* already disconnected */ } }
      if (rec.analyser) { try { rec.analyser.disconnect() } catch (e) { /* already disconnected */ } }
      if (rec.audioCtx) { try { rec.audioCtx.close() } catch (e) { /* already closed */ } }
    }
    voice.teardownRec = teardown
    function waitStop(recorder) {
      if (!recorder || recorder.state === 'inactive') return Promise.resolve()
      return new Promise((resolve) => recorder.addEventListener('stop', resolve, { once: true }))
    }
    async function openMic(mode, opId, target) {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(t('micUnavailable'))
      }
      const ns = voice.settings.noiseSuppression !== false
      const audio = {
        channelCount: 1,
        echoCancellation: ns,
        noiseSuppression: ns,
        autoGainControl: ns,
      }
      if (voice.settings.micDeviceId) audio.deviceId = { exact: voice.settings.micDeviceId }
      const stream = await navigator.mediaDevices.getUserMedia({ audio })
      let rec = null
      try {
        let mimeType = 'audio/webm;codecs=opus'
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = ''
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
        rec = {
          recorder, stream, mode,
          target: target || voice._activeTarget,
          opId: opId || (voice.activeOpId || 0),
          chunks: [],
          mime: mimeType || recorder.mimeType || 'audio/webm',
          audioCtx: null, analyser: null,
          cutting: false, closing: false,
          silenceMs: 0, hadSpeech: false,
          streamMs: 0,
        }
        recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) rec.chunks.push(e.data) }
        const AC = typeof AudioContext !== 'undefined' ? AudioContext
          : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null)
        if (AC) {
          rec.audioCtx = new AC()
          if (rec.audioCtx.state === 'suspended') { rec.audioCtx.resume().catch(() => {}) }
          const src = rec.audioCtx.createMediaStreamSource(stream)
          rec.srcNode = src
          let lastNode = src
          try {
            const filter = rec.audioCtx.createBiquadFilter()
            filter.type = 'highpass'
            filter.frequency.value = 80
            filter.Q.value = 0.707
            src.connect(filter)
            lastNode = filter
            rec.filterNode = filter
          } catch (e) { /* audio filter fallback */ }
          rec.analyser = rec.audioCtx.createAnalyser()
          rec.analyser.fftSize = 128
          lastNode.connect(rec.analyser)
        }
        recorder.start()
        if (voice.settings && voice.settings.vadEngine !== 'amplitude' && voice.sileroVad) {
          voice.sileroVad.init().catch(() => {})
        }
        if (voice.settings && voice.settings.streamingWs !== false && voice.streamingWs && voice.streamingWs.isSupported()) {
          voice.streamingWs.createStream({
            onInterim: (text) => {
              if (voice.phase === 'recording' && voice.settings.liveInterimPreview !== false) {
                voice.interimTranscript = text
                voice.notify()
              }
            },
            onError: () => { rec.wsStream = null },
          }).connect(rec.mime, mode).then((s) => { rec.wsStream = s }).catch(() => { rec.wsStream = null })
        }
        return rec
      } catch (err) {
        if (rec) {
          teardown(rec)
        } else {
          try { stream.getTracks().forEach((t) => t.stop()) } catch (_) {}
        }
        throw err
      }
    }
    function currentLevel(rec) {
      if (!rec || !rec.analyser) return 0
      const data = new Uint8Array(rec.analyser.frequencyBinCount)
      rec.analyser.getByteFrequencyData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i]
      const raw = Math.min(1, (sum / data.length / 255) * 2.2)

      if (rec.analyser.getByteTimeDomainData) {
        if (!rec._waveBuf || rec._waveBuf.length !== rec.analyser.fftSize) {
          rec._waveBuf = new Uint8Array(rec.analyser.fftSize)
        }
        rec.analyser.getByteTimeDomainData(rec._waveBuf)
        let clipped = false
        for (let i = 0; i < rec._waveBuf.length; i++) {
          const v = rec._waveBuf[i]
          if (v <= 1 || v >= 254) { clipped = true; break }
        }
        const now = Date.now()
        if (clipped) {
          rec.clippingUntil = now + 800
          rec.hasClipped = true
        }
        if (voice.settings && voice.settings.vadEngine !== 'amplitude' && voice.sileroVad && voice.sileroVad.isReady()) {
          if (!rec._floatBuf || rec._floatBuf.length !== rec._waveBuf.length) {
            rec._floatBuf = new Float32Array(rec._waveBuf.length)
          }
          for (let i = 0; i < rec._waveBuf.length; i++) {
            rec._floatBuf[i] = (rec._waveBuf[i] - 128) / 128
          }
          const vadRes = voice.sileroVad.evaluate(rec._floatBuf)
          rec.sileroSpeech = vadRes.isSpeech
        } else {
          rec.sileroSpeech = null
        }
        if (rec.hadSpeech && raw > 0 && raw < 0.08) {
          rec.lowVolumeUntil = now + 800
          rec.hasLowVolume = true
        }
        const isClipping = Boolean(rec.clippingUntil && rec.clippingUntil > now)
        const isLow = Boolean(!isClipping && rec.lowVolumeUntil && rec.lowVolumeUntil > now)
        if (!voice.audioQuality || voice.audioQuality.clipping !== isClipping || voice.audioQuality.lowVolume !== isLow) {
          voice.audioQuality = { clipping: isClipping, lowVolume: isLow }
          voice.notify()
        }
      }

      const gateDb = Number(voice.settings && voice.settings.noiseGateDb !== undefined ? voice.settings.noiseGateDb : -45)
      if (gateDb > -90) {
        const gateAmp = Math.pow(10, gateDb / 20) * 2.2
        if (raw < gateAmp) return 0
      }
      return raw
    }
    let dictationQueue = Promise.resolve()
    function cutPhrase() {
      const rec = voice.rec
      if (!rec || rec.cutting || rec.closing) return
      const opId = rec.opId || voice.activeOpId
      const target = rec.target || voice._activeTarget
      rec.cutting = true
      const stopped = waitStop(rec.recorder)
      try {
        if (rec.recorder && rec.recorder.state !== 'inactive') {
          rec.recorder.stop()
        }
      } catch (e) {
        rec.cutting = false
        return
      }
      stopped.then(async () => {
        if (rec.cancelled || voice.activeOpId !== opId || voice.disposed) return
        const blob = new Blob(rec.chunks, { type: rec.mime })
        rec.chunks = []
        rec.silenceMs = 0
        rec.hadSpeech = false
        rec.streamMs = 0
        if (!rec.closing && !rec.cancelled) {
          try {
            if (rec.recorder && rec.recorder.state === 'inactive') rec.recorder.start()
          } catch (e) { /* stream already closed */ }
        }
        rec.cutting = false
        if (rec.cancelled || blob.size < 600) return       // cancelled or too short — not speech
        if (rec.wsStream && rec.wsStream.isOpen) {
          rec.wsStream.sendBlobChunk(blob)
          rec.wsStream.requestInterim()
        }
        const q = { clipping: Boolean(rec.hasClipped), lowVolume: Boolean(rec.hasLowVolume) }
        rec.hasClipped = false
        rec.hasLowVolume = false
        dictationQueue = dictationQueue.then(async () => {
          if (rec.cancelled || voice.activeOpId !== opId || voice.disposed) return
          try {
            const out = await sendAudio(blob, rec.mime, 'dictation', q)
            if (rec.cancelled || voice.activeOpId !== opId || voice.disposed) return
            const text = out && out.text ? out.text : ''
            const action = out && out.action ? out.action : null
            if (voice.settings.structuredPromptVoice !== false && text) {
              const promptInfo = findActiveStructuredPrompt()
              if (promptInfo && submitToStructuredPrompt(text, promptInfo)) {
                return
              }
            }
            if (action === 'send' || action === 'clear' || action === 'newline' || action === 'undo_chunk') {
              executeVoiceAction(action, text, target)
              return
            }
            if (action === 'cancel') {
              cancelCurrent()
              return
            }
            const delay = Number(voice.settings.sendDelayMs) || 0
            if (text && delay > 0 && !voice.holding) {
              const ok = appendDraft(text, target)
              if (ok !== false) {
                voice.set({ phase: 'pending', pending: { text, target, undoOnly: true, leftMs: delay } })
              } else {
                voice.set({ phase: 'idle' })
              }
              return
            }
            if (text) appendDraft(text, target)
          } catch (e) {
            if (!rec.cancelled && voice.activeOpId === opId && !voice.disposed) {
              voice.set({ error: String(e && e.message ? e.message : e) })
            }
          }
        })
      })
    }
    function startBrowserLeg(mode, language, opId, target) {
      if (voice.settings && voice.settings.localOnly) return false
      if (!browserRecognitionAvailable()) return false
      const finals = []
      voice.caption = ''
      voice.browser = startBrowserRecognition({
        lang: language,
        continuous: true,
        onInterim: (text) => {
          if (voice.activeOpId !== opId || voice.phase !== 'recording' || voice.disposed) return
          voice.caption = text
          if (voice.settings.liveInterimPreview !== false) {
            voice.interimTranscript = text
          }
          voice.notify()
          const ww = String(voice.settings.wakeWord || '').trim().toLowerCase()
          if (ww && mode === 'dictation' && !voice.rec) {
            const t = String(text || '').trim().toLowerCase()
            if (t.startsWith(ww)) {
              if (voice.browser && typeof voice.browser.abort === 'function') {
                try { voice.browser.abort() } catch (_) {}
              }
              voice.browser = null
              voice.caption = ''
              voice.interimTranscript = ''
              openMic(mode, opId, target)
                .then((rec) => {
                  if (voice.activeOpId !== opId || voice.phase !== 'recording' || voice.disposed) {
                    teardown(rec)
                    return
                  }
                  rec.opId = opId
                  rec.target = target
                  voice.rec = rec
                  voice.notify()
                })
                .catch((err) => {
                  if (voice.activeOpId !== opId) return
                  voice.set({ phase: 'error', error: String(err && err.message ? err.message : err), rec: null })
                })
            }
          }
        },
        onFinal: (text) => {
          if (voice.activeOpId !== opId || (voice.phase !== 'recording' && voice.phase !== 'finishing') || voice.disposed) return
          finals.push(text)
          voice.caption = ''
          voice.interimTranscript = ''
          if (mode === 'dictation') appendDraft(text, target)
          else voice.notify()
        },
        onError: (reason) => {
          if (voice.activeOpId !== opId || voice.disposed) return
          voice.browser = null
          voice.interimTranscript = ''
          voice.set({ phase: 'error', error: t('browserFailed') + reason })
        },
      })
      voice.browserFinals = finals
      voice.notify()
      return true
    }
    function startRecording(mode) {
      if (voice.phase !== 'idle' && voice.phase !== 'error') return
      voice.activeOpId = (voice.activeOpId || 0) + 1
      const opId = voice.activeOpId
      const targetActions = voice.inputActions
      const targetInput = voice.input
      let span = null
      if (targetActions && typeof targetActions.captureInsertion === 'function') {
        try { span = targetActions.captureInsertion() } catch (_) {}
      }
      const initialDraft = (targetInput && typeof targetInput.draft === 'string') ? targetInput.draft : ''
      const targetSession = voice.session || (targetInput && targetInput.session)
      const sessionId = (targetSession && (targetSession.sessionId || targetSession.id))
        || voice.currentSessionId || ''
      const snapshotSubMode = voice.selectedDictationMode
        || (voice.settings && voice.settings.dictationMode)
        || 'clean'
      const target = { actions: targetActions, input: targetInput, session: targetSession, span, initialDraft, sessionId, dictationMode: snapshotSubMode }
      voice._activeTarget = target

      if (voice.isTtsSpeaking) {
        if (voice.settings.bargeIn) {
          triggerBargeIn()
        } else if (voice.settings.gatedTurnTaking !== false) {
          voice.set({ phase: 'error', error: t('assistantSpeakingGated') })
          return
        }
      }
      announceVoice('start')
      dictationQueue = Promise.resolve()
      voice.set({ phase: 'recording', mode, error: '', levels: [], caption: '', interimTranscript: '' })
      modeChain(mode).then((info) => {
        if (voice.activeOpId !== opId || voice.phase !== 'recording' || voice.disposed) return
        voice._activeChain = info.chain || []
        voice._activeLang = info.language || ''
        voice._activeModelMap = info.modelMap || {}
        if (info.chain[0] === 'browser' && !voice.settings.localOnly && startBrowserLeg(mode, info.language, opId, target)) return
        openMic(mode, opId, target)
          .then((rec) => {
            if (voice.activeOpId !== opId || voice.phase !== 'recording' || voice.disposed) {
              teardown(rec)
              return
            }
            rec.opId = opId
            rec.target = target
            voice.rec = rec
            voice.notify()
          })
          .catch((err) => {
            if (voice.activeOpId !== opId) return
            voice.set({ phase: 'error', error: String(err && err.message ? err.message : err), rec: null })
          })
      })
    }
    function startDictation() { startRecording('dictation') }
    function startMessage() { startRecording('message') }

    function cancelCurrent() {
      voice.activeOpId = (voice.activeOpId || 0) + 1
      announceVoice('end')
      focusComposer()
      if (voice.browser) {
        voice.browser.abort()
        voice.browser = null
        voice.browserFinals = null
        voice.set({ phase: 'idle', error: '', caption: '' })
        return
      }
      const rec = voice.rec
      voice.pending = null
      if (!rec) { voice.set({ phase: 'idle', error: '' }); return }
      rec.cancelled = true
      rec.closing = true
      const stopped = waitStop(rec.recorder)
      try {
        if (rec.recorder && rec.recorder.state !== 'inactive') rec.recorder.stop()
      } catch (e) { /* already stopped */ }
      stopped.then(() => { teardown(rec); voice.rec = null; voice.set({ phase: 'idle', error: '' }) })
    }
    function stopCurrent() {
      announceVoice('end')
      focusComposer()
      if (voice.browser) {
        const opId = voice.activeOpId
        const mode = voice.mode
        const b = voice.browser
        const target = voice._activeTarget
        voice.browser = null
        voice.caption = ''
        voice.set({ phase: 'finishing' })
        Promise.resolve(b.stop()).then(() => {
          if (voice.disposed || voice.activeOpId !== opId) return
          const said = (voice.browserFinals || []).join(' ').trim()
          voice.browserFinals = null
          if (!said) { voice.set({ phase: 'idle' }); return }
          if (mode === 'message') {
            const ok = appendDraft(said, target)
            if (ok !== false) {
              const usePreview = voice.settings.editablePreview !== false
              const autoMs = Number(voice.settings.autoSendMs) || 4000
              const pendingState = usePreview
                ? initPendingPreview(said, target, { autoSendMs: autoMs })
                : { text: said, target, totalMs: autoMs, leftMs: autoMs }
              voice.set({ phase: 'pending', pending: pendingState })
            } else {
              voice.set({ phase: 'idle' })
            }
          } else {
            voice.set({ phase: 'idle' })
          }
        })
        return
      }
      const rec = voice.rec
      if (!rec || rec.closing) return
      rec.closing = true
      const opId = rec.opId || voice.activeOpId
      const target = rec.target || voice._activeTarget
      const mode = rec.mode
      const stopped = waitStop(rec.recorder)
      try {
        if (rec.recorder && rec.recorder.state !== 'inactive') rec.recorder.stop()
      } catch (e) { /* already stopped */ }
      stopped.then(async () => {
        if (voice.disposed || rec.cancelled || voice.activeOpId !== opId) {
          teardown(rec)
          if (voice.rec === rec) voice.rec = null
          return
        }
        const blob = new Blob(rec.chunks, { type: rec.mime })
        teardown(rec)
        if (voice.rec === rec) voice.rec = null
        if (voice.disposed || rec.cancelled || voice.activeOpId !== opId) return
        if (blob.size < (mode === 'dictation' ? 600 : 1200)) {
          if (mode === 'dictation') { try { await dictationQueue } catch (_) {} }
          voice.set({ phase: 'idle' })
          return
        }
        if (voice.lastNote && voice.lastNote.url) {
          try { URL.revokeObjectURL(voice.lastNote.url) } catch (e) {}
        }
        let noteUrl = ''
        try { noteUrl = URL.createObjectURL(blob) } catch (e) {}
        voice.lastNote = { blob, url: noteUrl, mime: rec.mime, text: '' }
        voice.set({ phase: 'processing' })
        const q = { clipping: Boolean(rec.hasClipped), lowVolume: Boolean(rec.hasLowVolume) }
        rec.hasClipped = false
        rec.hasLowVolume = false
        const processTail = async () => {
          if (voice.disposed || rec.cancelled || voice.activeOpId !== opId || voice.phase === 'idle') return
          try {
            const out = await sendAudio(blob, rec.mime, mode, q)
            if (voice.disposed || rec.cancelled || voice.activeOpId !== opId || voice.phase === 'idle') return
            if (out.command) { runSessionCommand(out.command); return }
            const text = out.text || ''
            const action = out.action || null
            if (!text && !action) {
              if (mode === 'message') voice.set({ phase: 'error', error: t('nothingHeard') })
              else voice.set({ phase: 'idle' })
              return
            }
            if (voice.settings.structuredPromptVoice !== false && text) {
              const promptInfo = findActiveStructuredPrompt()
              if (promptInfo && submitToStructuredPrompt(text, promptInfo)) {
                voice.set({ phase: 'idle' })
                return
              }
            }
            if (action === 'send' || action === 'clear' || action === 'newline' || action === 'undo_chunk') {
              executeVoiceAction(action, text, target)
              return
            }
            if (action === 'cancel') { cancelCurrent(); return }
            const ok = appendDraft(text, target)
            if (voice.lastNote) voice.lastNote.text = text
            if (mode === 'message') {
              if (ok !== false) {
                const usePreview = voice.settings.editablePreview !== false
                let polishedText = text
                if (usePreview && voice.settings.polishSend) {
                  try {
                    const pRes = await fetch('/dsh-voice/polish', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json', ...(typeof window !== 'undefined' && window.__dshVoiceToken ? { 'x-dsh-voice-token': window.__dshVoiceToken } : {}) },
                      body: JSON.stringify({ text }),
                    })
                    const pData = await pRes.json()
                    if (pData && pData.text) polishedText = pData.text
                  } catch (_) {}
                }
                const autoMs = Number(voice.settings.autoSendMs) || 4000
                const pendingState = usePreview
                  ? initPendingPreview(text, target, { autoSendMs: autoMs, polishedText, audioUrl: noteUrl, polishSend: voice.settings.polishSend })
                  : { text, target, totalMs: autoMs, leftMs: autoMs, audioUrl: noteUrl }
                voice.set({ phase: 'pending', pending: pendingState })
              } else {
                voice.set({ phase: 'idle' })
              }
            } else {
              voice.set({ phase: 'idle' })
            }
          } catch (e) {
            if (voice.disposed || rec.cancelled || voice.activeOpId !== opId || voice.phase === 'idle') return
            voice.set({ phase: 'error', error: String(e && e.message ? e.message : e) })
          }
        }
        if (mode === 'dictation') {
          dictationQueue = dictationQueue.then(processTail)
          try { await dictationQueue } catch (_) {}
        } else {
          await processTail()
        }
      })
    }
    function clearDraft(target) {
      const activeTarget = target || voice._activeTarget
      const actions = (activeTarget && activeTarget.actions) || voice.inputActions
      if (actions && typeof actions.setDraft === 'function') actions.setDraft('')
    }

    // Voice actions (#29-7): spoken triggers perform composer actions.
    function executeVoiceAction(action, rawText, target) {
      const activeTarget = target || voice._activeTarget
      const actions = (activeTarget && activeTarget.actions) || voice.inputActions
      if (action === 'send') {
        const text = rawText.replace(/(^|[\s,.!?])(отправь|пошли|send)([\s,.!?]|$)/gi, '').trim()
        if (text) appendDraft(text, activeTarget)
        if (typeof actions?.submit === 'function') {
          actions.submit()
        }
        voice.set({ phase: 'idle' })
      } else if (action === 'clear') {
        clearDraft(activeTarget)
        voice.set({ phase: 'idle' })
      } else if (action === 'newline') {
        const payload = (rawText.replace(/(^|[\s,.!?])(с новой строки|новая строка|абзац|new line|paragraph)([\s,.!?]|$)/gi, '').trim())
        appendDraft(payload, activeTarget)
        voice.set({ phase: 'idle' })
      } else if (action === 'undo_chunk') {
        undoLastInsert().then((msg) => {
          voice.lastUndoNotice = msg
          voice.notify()
          setTimeout(() => {
            if (voice.lastUndoNotice === msg) {
              voice.lastUndoNotice = ''
              voice.notify()
            }
          }, 3500)
        })
      }
    }

    function submitPending() {
      submitPendingPreview(voice)
    }

    function cancelPending() {
      cancelPendingPreview(voice)
    }

    function runSessionCommand(cmd) {
      if (cmd === 'send') submitPending()
      else if (cmd === 'cancel') cancelCurrent()
      else if (cmd === 'stop') cancelCurrent()
      else if (cmd === 'continue') { /* keep recording */ }
      else if (cmd === 'undo_chunk') { executeVoiceAction('undo_chunk') }
    }

    function keepPending() {
      keepPendingPreview(voice)
    }
