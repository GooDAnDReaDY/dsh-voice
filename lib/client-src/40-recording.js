    voice._chainsPromise = null
    function modeChain(mode) {
      if (!voice._chainsPromise) {
        voice._chainsPromise = fetch('/dsh-voice/status', { cache: 'no-store' })
          .then((res) => res.json())
          .then((data) => (data && data.modes) || {})
          .catch(() => {
            voice._chainsPromise = null
            return {}
          })
      }
      return voice._chainsPromise.then((modes) => {
        const row = modes[mode] || {}
        return {
          chain: Array.isArray(row.chain) ? row.chain.map((e) => e && e.provider) : [],
          language: row.language !== undefined ? row.language : '',
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
    async function openMic(mode) {
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
      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = ''
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      const rec = {
        recorder, stream, mode,
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
        if (rec.cancelled || voice.activeOpId !== opId) return
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
        if (rec.cancelled) return
        try {
          const out = await sendAudio(blob, rec.mime, 'dictation')
          if (rec.cancelled) return
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
            appendDraft(text)
            voice.set({ phase: 'pending', pending: { text, undoOnly: true, leftMs: delay } })
            return
          }
          if (text) appendDraft(text)
        } catch (e) {
          if (!rec.cancelled) {
            voice.set({ error: String(e && e.message ? e.message : e) })
          }
        }
        })
      })
    }
    function startBrowserLeg(mode, language) {
      if (voice.settings && voice.settings.localOnly) return false
      if (!browserRecognitionAvailable()) return false
      const finals = []
      voice.caption = ''
      voice.browser = startBrowserRecognition({
        lang: language,
        continuous: true,
        onInterim: (text) => {
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
              openMic(mode)
                .then((rec) => {
                  if (voice.phase !== 'recording') {
                    teardown(rec)
                    return
                  }
                  voice.rec = rec
                  voice.notify()
                })
                .catch((err) => voice.set({ phase: 'error', error: String(err && err.message ? err.message : err), rec: null }))
            }
          }
        },
        onFinal: (text) => {
          finals.push(text)
          voice.caption = ''
          voice.interimTranscript = ''
          if (mode === 'dictation') appendDraft(text)
          else voice.notify()
        },
        onError: (reason) => {
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
        if (info.chain[0] === 'browser' && startBrowserLeg(mode, info.language)) return
        openMic(mode)
          .then((rec) => {
            if (voice.phase !== 'recording') {
              teardown(rec)
              return
            }
            voice.rec = rec
            voice.notify()
          })
          .catch((err) => voice.set({ phase: 'error', error: String(err && err.message ? err.message : err), rec: null }))
      })
    }
    function startDictation() { startRecording('dictation') }
    function startMessage() { startRecording('message') }
    // --------------------------------------------------------- hold gesture
    const HOLD_THRESHOLD_MS = 350
    const hold = { active: false, mode: null, startedAt: 0, armed: false }
    let activePointerCleanup = null
    function beginHold(mode, pointerEvent) {
      if (hold.armed || (voice.phase !== 'idle' && voice.phase !== 'error')) return
      hold.armed = true
      hold.mode = mode
      hold.startedAt = Date.now()
      hold.active = false
      if (pointerEvent?.target?.setPointerCapture && pointerEvent.pointerId !== undefined) {
        try { pointerEvent.target.setPointerCapture(pointerEvent.pointerId) } catch (e) {}
      }
      if (typeof window !== 'undefined') {
        if (activePointerCleanup) { try { activePointerCleanup() } catch (e) {} }
        const onUp = () => endHold(false)
        const onCancel = () => endHold(true)
        window.addEventListener('pointerup', onUp, true)
        window.addEventListener('pointercancel', onCancel, true)
        window.addEventListener('blur', onCancel, true)
        activePointerCleanup = () => {
          window.removeEventListener('pointerup', onUp, true)
          window.removeEventListener('pointercancel', onCancel, true)
          window.removeEventListener('blur', onCancel, true)
          activePointerCleanup = null
        }
      }
      startRecording(mode)
      voice.holding = true
      voice.notify()
    }
    function endHold(cancelled) {
      if (!hold.armed) return
      if (activePointerCleanup) { try { activePointerCleanup() } catch (e) {} }
      const heldMs = Date.now() - hold.startedAt
      hold.armed = false
      hold.active = false
      voice.holding = false
      if (!cancelled && heldMs < HOLD_THRESHOLD_MS) { voice.notify(); return }
      if (cancelled) cancelCurrent()
      else stopCurrent()
    }

    let activeHotkeyCleanup = null
    function clearGlobalHotkey() {
      if (typeof activeHotkeyCleanup === 'function') {
        try { activeHotkeyCleanup() } catch (_) { /* ignore */ }
        activeHotkeyCleanup = null
      }
      if (typeof window !== 'undefined' && typeof window.__dsh_voice_hotkey_cleanup === 'function') {
        try { window.__dsh_voice_hotkey_cleanup() } catch (_) { /* ignore */ }
        window.__dsh_voice_hotkey_cleanup = null
      }
    }
    voice.clearGlobalHotkey = clearGlobalHotkey
    function installHotkey(ctx, keyName, mode) {
      clearGlobalHotkey()
      if (typeof document === 'undefined' || !keyName) return () => {}
      const down = (event) => {
        if (event.repeat) return
        const target = event.target
        const isEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || (typeof target.getAttribute === 'function' && target.getAttribute('contenteditable') === 'true'))
        if (isEditable && !isAllowedInEditable(keyName)) return
        if (hotkeyMatches(event, keyName)) {
          event.preventDefault()
          event.stopPropagation()
          beginHold(mode)
        }
      }

      const up = (event) => {
        if (hold.armed && isHotkeyRelease(event, keyName)) {
          event.preventDefault()
          endHold(false)
        } else if (event.key === 'Escape' && hold.armed) {
          event.preventDefault()
          endHold(true)
        }
      }
      const blur = () => { if (hold.armed) endHold(true) }
      document.addEventListener('keydown', down, true)
      document.addEventListener('keyup', up, true)
      window.addEventListener('blur', blur)
      const cleanup = () => {
        document.removeEventListener('keydown', down, true)
        document.removeEventListener('keyup', up, true)
        window.removeEventListener('blur', blur)
        if (activeHotkeyCleanup === cleanup) activeHotkeyCleanup = null
        if (typeof window !== 'undefined' && window.__dsh_voice_hotkey_cleanup === cleanup) {
          window.__dsh_voice_hotkey_cleanup = null
        }
      }
      activeHotkeyCleanup = cleanup
      if (typeof window !== 'undefined') {
        window.__dsh_voice_hotkey_cleanup = cleanup
      }
      return cleanup
    }
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
        const mode = voice.mode
        const b = voice.browser
        voice.browser = null
        voice.caption = ''
        Promise.resolve(b.stop()).then(() => {
          const said = (voice.browserFinals || []).join(' ').trim()
          voice.browserFinals = null
          if (!said) { voice.set({ phase: 'idle' }); return }
          if (mode === 'message') {
            appendDraft(said)
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
      voice.activeOpId = (voice.activeOpId || 0) + 1
      const opId = voice.activeOpId
      const mode = rec.mode
      const stopped = waitStop(rec.recorder)
      try {
        if (rec.recorder && rec.recorder.state !== 'inactive') rec.recorder.stop()
      } catch (e) { /* already stopped */ }
      stopped.then(async () => {
        const blob = new Blob(rec.chunks, { type: rec.mime })
        teardown(rec)
        voice.rec = null
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
          if (rec.cancelled || voice.activeOpId !== opId || voice.phase === 'idle') return
          try {
            const out = await sendAudio(blob, rec.mime, mode)
            if (rec.cancelled || voice.activeOpId !== opId || voice.phase === 'idle') return
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
            appendDraft(text)
            if (voice.lastNote) voice.lastNote.text = text
            if (mode === 'message') {
              voice.set({ phase: 'pending', pending: { text, totalMs: voice.settings.autoSendMs, leftMs: voice.settings.autoSendMs, audioUrl: noteUrl } })
            } else {
              voice.set({ phase: 'idle' })
            }
          } catch (e) {
            if (rec.cancelled || voice.activeOpId !== opId || voice.phase === 'idle') return
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
      if (!actions || typeof actions.setDraft !== 'function') {
        voice.set({ phase: 'error', error: t('composerUnavailable') })
        return false
      }
      actions.setDraft('')
      return true
    }
    function executeVoiceAction(action, text) {
      if (action === 'send') {
        if (text) appendDraft(text)
        submitPending()
        return true
      }
      if (action === 'clear') {
        const ok = clearDraft()
        if (ok && voice.phase !== 'recording') voice.set({ phase: 'idle' })
        return ok
      }
      if (action === 'newline') {
        const payload = text ? (text.endsWith('\n') ? text : text + '\n') : '\n'
        appendDraft(payload)
        if (voice.phase !== 'recording') voice.set({ phase: 'idle' })
        return true
      }
      if (action === 'cancel') { cancelCurrent(); return true }
      return false
    }
    voice.executeVoiceAction = executeVoiceAction
    function submitPending() {
      voice.pending = null
      const actions = voice.inputActions
      if (!actions || typeof actions.submit !== 'function') {
        voice.set({ phase: 'error', error: t('composerUnavailable') })
        return
      }
      voice.set({ phase: 'idle' })
      if (voice.settings.polishSend) {
        const run = async () => {
          try {
            const draft = voice.input && typeof voice.input.draft === 'string' ? voice.input.draft : ''
            if (draft.trim()) {
              const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
              const timer = controller ? setTimeout(() => controller.abort(), 10000) : null
              try {
                const res = await fetch('/dsh-voice/polish', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ text: draft }),
                  signal: controller ? controller.signal : undefined,
                })
                const parsed = await res.json().catch(() => null)
                if (parsed && parsed.ok && typeof parsed.text === 'string' && parsed.text.trim()) {
                  actions.setDraft(parsed.text.trim())
                }
              } finally {
                if (timer) clearTimeout(timer)
              }
            }
          } catch (e) { /* polish is best-effort */ }
        }
        run().finally(() => setTimeout(() => { try { actions.submit() } catch (e) { /* busy */ } }, 0))
        return
      }
      setTimeout(() => { try { actions.submit() } catch (e) { /* composer busy */ } }, 0)
    }
    function runSessionCommand(cmd) {
      const actions = voice.inputActions
      voice.set({ phase: 'idle', pending: null })
      if ((cmd === 'send' || cmd === 'continue') && actions && typeof actions.submit === 'function') {
        actions.submit()
      }
    }
    function keepPending() {
      voice.pending = null
      voice.set({ phase: 'idle' })
    }
