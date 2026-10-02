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
        dictationQueue = dictationQueue.then(async () => {
          if (rec.cancelled || voice.activeOpId !== opId || voice.disposed) return
          try {
            const out = await sendAudio(blob, rec.mime, 'dictation')
            if (rec.cancelled || voice.activeOpId !== opId || voice.disposed) return
            const text = out && out.text ? out.text : ''
            const action = out && out.action ? out.action : null
            if (voice.settings.structuredPromptVoice !== false && text) {
              const promptInfo = findActiveStructuredPrompt()
              if (promptInfo && submitToStructuredPrompt(text, promptInfo)) {
                return
              }
            }
            if (action === 'send' || action === 'clear' || action === 'newline') {
              executeVoiceAction(action, text)
              return
            }
            if (action === 'cancel') {
              cancelCurrent()
              return
            }
            const delay = Number(voice.settings.sendDelayMs) || 0
            if (text && delay > 0 && !voice.holding) {
              appendDraft(text, target)
              voice.set({ phase: 'pending', pending: { text, undoOnly: true, leftMs: delay } })
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
      const target = { actions: targetActions, input: targetInput, span }
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
            appendDraft(said, target)
            voice.set({ phase: 'pending', pending: { text: said, leftMs: voice.settings.autoSendMs } })
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
        const processTail = async () => {
          if (voice.disposed || rec.cancelled || voice.activeOpId !== opId || voice.phase === 'idle') return
          try {
            const out = await sendAudio(blob, rec.mime, mode)
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
            if (action === 'send' || action === 'clear' || action === 'newline') {
              executeVoiceAction(action, text)
              return
            }
            if (action === 'cancel') { cancelCurrent(); return }
            appendDraft(text, target)
            if (voice.lastNote) voice.lastNote.text = text
            if (mode === 'message') {
              voice.set({ phase: 'pending', pending: { text, totalMs: voice.settings.autoSendMs, leftMs: voice.settings.autoSendMs, audioUrl: noteUrl } })
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
    function clearDraft() {
      const actions = voice.inputActions
      if (actions && typeof actions.setDraft === 'function') actions.setDraft('')
    }

    // Voice actions (#29-7): spoken triggers perform composer actions.
    function executeVoiceAction(action, rawText) {
      if (action === 'send') {
        const text = rawText.replace(/(^|[\s,.!?])(отправь|пошли|send)([\s,.!?]|$)/gi, '').trim()
        if (text) appendDraft(text)
        if (typeof voice.inputActions?.submit === 'function') {
          voice.inputActions.submit()
        }
        voice.set({ phase: 'idle' })
      } else if (action === 'clear') {
        clearDraft()
        voice.set({ phase: 'idle' })
      } else if (action === 'newline') {
        const payload = (rawText.replace(/(^|[\s,.!?])(с новой строки|новая строка|абзац|new line|paragraph)([\s,.!?]|$)/gi, '').trim())
        appendDraft(payload)
        voice.set({ phase: 'idle' })
      }
    }

    function submitPending() {
      const pending = voice.pending
      if (!pending) return
      const text = pending.text
      const actions = voice.inputActions
      voice.pending = null
      voice.set({ phase: 'idle' })

      if (voice.settings.polishSend) {
        fetch('/dsh-voice/polish', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text }),
        })
          .then((res) => res.json())
          .then((data) => {
            const polished = (data && data.text) || text
            if (actions && typeof actions.setDraft === 'function') {
              actions.setDraft(polished)
            }
            if (actions && typeof actions.submit === 'function') {
              actions.submit()
            }
          })
          .catch(() => {
            if (actions && typeof actions.submit === 'function') {
              actions.submit()
            }
          })
      } else if (actions && typeof actions.submit === 'function') {
        actions.submit()
      }
    }

    function runSessionCommand(cmd) {
      if (cmd === 'send') submitPending()
      else if (cmd === 'cancel') cancelCurrent()
      else if (cmd === 'stop') cancelCurrent()
      else if (cmd === 'continue') { /* keep recording */ }
    }

    function keepPending() {
      voice.pending = null
      voice.set({ phase: 'idle' })
    }
