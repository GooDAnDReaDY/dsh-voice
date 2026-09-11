    // to use browser recognition or record a file.
    let chainsPromise = null
    if (typeof window !== 'undefined') {
      window.addEventListener('dsh-voice:settings-saved', () => { chainsPromise = null })
    }
    function modeChain(mode) {
      if (!chainsPromise) {
        chainsPromise = fetch('/dsh-voice/status', { cache: 'no-store' })
          .then((res) => res.json())
          .then((data) => (data && data.modes) || {})
          .catch(() => ({}))
      }
      return chainsPromise.then((modes) => {
        const row = modes[mode] || {}
        return {
          chain: Array.isArray(row.chain) ? row.chain.map((e) => e && e.provider) : [],
          language: row.language || 'ru',
        }
      })
    }

    // ------------------------------------------------------------ recording
    function teardown(rec) {
      if (!rec) return
      try { rec.stream.getTracks().forEach((t) => t.stop()) } catch (e) { /* already stopped */ }
      if (rec.audioCtx) { try { rec.audioCtx.close() } catch (e) { /* already closed */ } }
    }

    function waitStop(recorder) {
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
        const src = rec.audioCtx.createMediaStreamSource(stream)
        rec.analyser = rec.audioCtx.createAnalyser()
        rec.analyser.fftSize = 128
        src.connect(rec.analyser)
      }
      // No timeslice: only then each stop() yields a standalone webm file.
      recorder.start()
      return rec
    }

    function currentLevel(rec) {
      if (!rec || !rec.analyser) return 0
      const data = new Uint8Array(rec.analyser.frequencyBinCount)
      rec.analyser.getByteFrequencyData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i]
      return Math.min(1, (sum / data.length / 255) * 2.2)
    }

    // Cut the current phrase: stop the recorder, send the finished file and
    // immediately start a new recording with the same recorder.
    function cutPhrase() {
      const rec = voice.rec
      if (!rec || rec.cutting || rec.closing) return
      rec.cutting = true
      const stopped = waitStop(rec.recorder)
      try { rec.recorder.stop() } catch (e) { /* already stopped */ }
      stopped.then(async () => {
        const blob = new Blob(rec.chunks, { type: rec.mime })
        rec.chunks = []
        rec.silenceMs = 0
        rec.hadSpeech = false
        rec.streamMs = 0
        if (!rec.closing) {
          try { rec.recorder.start() } catch (e) { /* stream already closed */ }
        }
        rec.cutting = false
        if (blob.size < 1200) return       // too short — not speech
        try {
          const out = await sendAudio(blob, rec.mime, 'dictation')
          const text = out && out.text ? out.text : ''
          const delay = Number(voice.settings.sendDelayMs) || 0
          if (text && delay > 0 && !voice.holding) {
            // Delayed insert with a cancel window (#29-5): text is already
            // inserted; the window only allows undoing it.
            appendDraft(text)
            voice.set({ phase: 'pending', pending: { text, undoOnly: true, leftMs: delay } })
            return
          }
          if (text) appendDraft(text)
        } catch (e) {
          voice.set({ error: String(e && e.message ? e.message : e) })
        }
      })
    }

    // Browser recognition instead of file recording. Returns false when the
    // browser cannot do it — then fall back to the normal path.
    function startBrowserLeg(mode, language) {
      if (!browserRecognitionAvailable()) return false
      const finals = []
      voice.caption = ''
      voice.browser = startBrowserRecognition({
        lang: language,
        continuous: true,
        onInterim: (text) => {
          voice.caption = text; voice.notify()
          // Wake-word (#45): if interim starts with the trigger phrase, stop
          // browser listening and switch to normal recording.
          const ww = String(voice.settings.wakeWord || '').trim().toLowerCase()
          if (ww && mode === 'dictation' && !voice.rec) {
            const t = String(text || '').trim().toLowerCase()
            if (t.startsWith(ww)) {
              voice.browser = null
              voice.caption = ''
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
          // Dictation appends immediately; messages accumulate until release.
          if (mode === 'dictation') appendDraft(text)
          else voice.notify()
        },
        onError: (reason) => {
          // Browser failed after start — say so instead of pretending to listen.
          voice.browser = null
          voice.set({ phase: 'error', error: t('browserFailed') + reason })
        },
      })
      voice.browserFinals = finals
      voice.notify()
      return true
    }

    function startRecording(mode) {
      if (voice.phase !== 'idle' && voice.phase !== 'error') return
      // Announce before opening the mic: the sooner playback mutes, the less
      // of it ends up in the recording.
      announceVoice('start')
      voice.set({ phase: 'recording', mode, error: '', levels: [], caption: '' })
      modeChain(mode).then((info) => {
        // Browser leg only when it is explicitly first in the chain.
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
    //
    // Two gestures on one button: a short click toggles recording until the
    // next click; hold records only while pressed. Release sends.
    //
    // Distinguished by time: release before the threshold is a click.
    const HOLD_THRESHOLD_MS = 350

    const hold = { active: false, mode: null, startedAt: 0, armed: false }

    function beginHold(mode) {
      if (hold.armed || (voice.phase !== 'idle' && voice.phase !== 'error')) return
      hold.armed = true
      hold.mode = mode
      hold.startedAt = Date.now()
      hold.active = false
      // Start recording immediately: waiting for the threshold loses the first word.
      startRecording(mode)
      voice.holding = true
      voice.notify()
    }

    function endHold(cancelled) {
      if (!hold.armed) return
      const heldMs = Date.now() - hold.startedAt
      hold.armed = false
      hold.active = false
      voice.holding = false
      // Short press is a click: recording is already on, leave it running;
      // the second click will stop it.
      if (!cancelled && heldMs < HOLD_THRESHOLD_MS) { voice.notify(); return }
      if (cancelled) cancelCurrent()
      else stopCurrent()
    }

    // Hotkey: holding a key is easier than aiming the mouse. While the key is
    // down we record; Escape cancels.
    function hotkeyMatches(event, name) {
      if (name === 'Control') return event.key === 'Control'
      if (name === 'Alt') return event.key === 'Alt'
      if (name === 'Shift') return event.key === 'Shift'
      return event.code === name || event.key === name
    }

    function installHotkey(ctx, keyName, mode) {
      if (typeof document === 'undefined' || !keyName) return () => {}
      const down = (event) => {
        if (event.repeat) return
        // A modifier hotkey does not fight the text field: modifiers do not
        // type. A plain letter key must not be hijacked while typing.
        if (hotkeyMatches(event, keyName)) beginHold(mode)
      }
      const up = (event) => {
        if (hotkeyMatches(event, keyName)) endHold(false)
        else if (event.key === 'Escape' && hold.armed) endHold(true)
      }
      const blur = () => { if (hold.armed) endHold(true) }
      document.addEventListener('keydown', down, true)
      document.addEventListener('keyup', up, true)
      window.addEventListener('blur', blur)
      return () => {
        document.removeEventListener('keydown', down, true)
        document.removeEventListener('keyup', up, true)
        window.removeEventListener('blur', blur)
      }
    }

    function cancelCurrent() {
      announceVoice('end')
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
      rec.closing = true
      const stopped = waitStop(rec.recorder)
      try { rec.recorder.stop() } catch (e) { /* already stopped */ }
      stopped.then(() => { teardown(rec); voice.rec = null; voice.set({ phase: 'idle', error: '' }) })
    }

    // Stop on the second click: dictation flushes the tail; a voice message
    // sends the whole recording and opens the cancel window.
    function stopCurrent() {
      announceVoice('end')
      if (voice.browser) {
        const mode = voice.mode
        const said = (voice.browserFinals || []).join(' ').trim()
        voice.browser.stop()
        voice.browser = null
        voice.browserFinals = null
        voice.caption = ''
        if (!said) { voice.set({ phase: 'idle' }); return }
        if (mode === 'message') {
          appendDraft(said)
          voice.set({ phase: 'pending', pending: { text: said, leftMs: voice.settings.autoSendMs } })
        } else {
          // Dictation already appended while speaking — nothing extra to add.
          voice.set({ phase: 'idle' })
        }
        return
      }
      const rec = voice.rec
      if (!rec || rec.closing) return
      rec.closing = true
      const mode = rec.mode
      const stopped = waitStop(rec.recorder)
      try { rec.recorder.stop() } catch (e) { /* already stopped */ }
      stopped.then(async () => {
        const blob = new Blob(rec.chunks, { type: rec.mime })
        teardown(rec)
        voice.rec = null
        if (blob.size < 1200) { voice.set({ phase: 'idle' }); return }
        if (voice.lastNote && voice.lastNote.url) {
          try { URL.revokeObjectURL(voice.lastNote.url) } catch (e) { /* ignore */ }
        }
        let noteUrl = ''
        try { noteUrl = URL.createObjectURL(blob) } catch (e) { /* ignore */ }
        voice.lastNote = { blob, url: noteUrl, mime: rec.mime, text: '' }
        voice.set({ phase: 'processing' })
        try {
          const out = await sendAudio(blob, rec.mime, mode)
          if (out.command) { runSessionCommand(out.command); return }
          const text = out.text || ''
          if (!text) { voice.set({ phase: 'error', error: t('nothingHeard') }); return }
          appendDraft(text)
          if (voice.lastNote) voice.lastNote.text = text
          if (mode === 'message') {
            voice.set({ phase: 'pending', pending: { text: text, leftMs: voice.settings.autoSendMs, audioUrl: noteUrl } })
          } else {
            voice.set({ phase: 'idle' })
          }
        } catch (e) {
          voice.set({ phase: 'error', error: String(e && e.message ? e.message : e) })
        }
      })
    }

    function submitPending() {
      voice.pending = null
      voice.set({ phase: 'idle' })
      const actions = voice.inputActions
      if (!actions || typeof actions.submit !== 'function') return
      // Polish the whole draft before submit (#46). Errors do not block.
      if (voice.settings.polishSend) {
        const run = async () => {
          try {
            const draft = voice.input && typeof voice.input.draft === 'string' ? voice.input.draft : ''
            if (draft.trim()) {
              const res = await fetch('/dsh-voice/polish', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ text: draft }),
              })
              const parsed = await res.json().catch(() => null)
              if (parsed && parsed.ok && typeof parsed.text === 'string' && parsed.text.trim()) {
                actions.setDraft(parsed.text.trim())
              }
            }
          } catch (e) { /* polish is best-effort */ }
        }
        run().finally(() => setTimeout(() => { try { actions.submit() } catch (e) { /* busy */ } }, 0))
        return
      }
      setTimeout(() => { try { actions.submit() } catch (e) { /* composer busy */ } }, 0)
    }

    // Session voice commands (#48): clean "send/cancel/stop/continue".
    function runSessionCommand(cmd) {
      const actions = voice.inputActions
      voice.set({ phase: 'idle', pending: null })
      switch (cmd) {
        case 'send':
        case 'continue':
          if (actions && typeof actions.submit === 'function') actions.submit()
          break
        case 'cancel':
        case 'stop':
          // Clear wait/recording; leave the draft text intentionally untouched.
          break
        default:
          break
      }
    }

    function keepPending() {
      voice.pending = null
      voice.set({ phase: 'idle' })
    }

