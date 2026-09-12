    // ---------------------------------------------------------------- store
    const voice = {
      phase: 'idle',      // idle | recording | processing | pending | error
      mode: 'dictation',  // dictation | message
      error: '',
      rec: null,
      levels: [],
      pending: null,      // {text, leftMs} — message-mode cancel window
      lastNote: null,     // {blob, url, mime, text} — last recording
      showPlayer: false,
      inputActions: null,
      input: null,
      settings: { vadSilenceMs: 700, autoSendMs: 4000, stream: false, streamChunkMs: 1200, vadAdapt: 0, noiseSuppression: true, contextGlossary: true },
      listeners: new Set(),
      notify() { this.listeners.forEach((l) => l()) },
      set(patch) { Object.assign(this, patch); this.notify() },
      subscribe(l) { this.listeners.add(l); return () => this.listeners.delete(l) },
    }

    function useVoice() {
      const [, force] = React.useReducer((x) => x + 1, 0)
      React.useEffect(() => voice.subscribe(force), [])
      return voice
    }

    // ---------------------------------------------------------------- icons
    const ic = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
    const playIcon = () => React.createElement('svg', Object.assign({}, ic, { viewBox: '0 0 24 24' }),
      React.createElement('polygon', { points: '6 4 20 12 6 20 6 4', fill: 'currentColor', stroke: 'none' }))
    const pauseIcon = () => React.createElement('svg', Object.assign({}, ic, { viewBox: '0 0 24 24' }),
      React.createElement('rect', { x: 6, y: 4, width: 4, height: 16, fill: 'currentColor', stroke: 'none' }),
      React.createElement('rect', { x: 14, y: 4, width: 4, height: 16, fill: 'currentColor', stroke: 'none' }))
    const micIcon = () => React.createElement('svg', ic,
      React.createElement('path', { d: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z' }),
      React.createElement('path', { d: 'M19 10v2a7 7 0 0 1-14 0v-2' }),
      React.createElement('line', { x1: 12, y1: 19, x2: 12, y2: 23 }))
    const waveIcon = () => React.createElement('svg', ic,
      React.createElement('line', { x1: 4, y1: 10, x2: 4, y2: 14 }),
      React.createElement('line', { x1: 8, y1: 7, x2: 8, y2: 17 }),
      React.createElement('line', { x1: 12, y1: 4, x2: 12, y2: 20 }),
      React.createElement('line', { x1: 16, y1: 7, x2: 16, y2: 17 }),
      React.createElement('line', { x1: 20, y1: 10, x2: 20, y2: 14 }))
    const xIcon = () => React.createElement('svg', ic,
      React.createElement('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
      React.createElement('line', { x1: 6, y1: 6, x2: 18, y2: 18 }))
    const stopIcon = () => React.createElement('svg', ic,
      React.createElement('rect', { x: 7, y: 7, width: 10, height: 10, rx: 2.5, fill: 'currentColor', stroke: 'none' }))
    const spinIcon = () => React.createElement('svg', Object.assign({}, ic, { className: 'dvo-spin' }),
      React.createElement('path', { d: 'M21 12a9 9 0 1 1-6.219-8.56' }))
    const warnIcon = () => React.createElement('svg', ic,
      React.createElement('path', { d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }),
      React.createElement('line', { x1: 12, y1: 9, x2: 12, y2: 13 }),
      React.createElement('line', { x1: 12, y1: 17, x2: 12.01, y2: 17 }))
    const chevronIcon = () => React.createElement('svg', ic,
      React.createElement('path', { d: 'M6 9l6 6 6-6' }))

    // ------------------------------------------------------------ transport
    function blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        if (typeof FileReader === 'undefined') { reject(new Error('FileReader not supported')); return }
        const fr = new FileReader()
        fr.onload = () => { const s = String(fr.result || ''); resolve(s.indexOf(',') >= 0 ? s.slice(s.indexOf(',') + 1) : s) }
        fr.onerror = () => reject(new Error('failed to read audio'))
        fr.readAsDataURL(blob)
      })
    }

    function extractContextKeywords() {
      if (!voice.settings || voice.settings.contextGlossary === false) return []
      const text = (voice.input && typeof voice.input.draft === 'string') ? voice.input.draft : ''
      if (!text || text.length < 3) return []
      const matches = text.match(/\b[A-Za-z_][A-Za-z0-9_]{2,29}\b/g) || []
      const stop = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'])
      const words = []
      const seen = new Set()
      for (const m of matches) {
        const lower = m.toLowerCase()
        if (!stop.has(lower) && !seen.has(lower)) {
          seen.add(lower)
          words.push(m)
          if (words.length >= 30) break
        }
      }
      return words
    }

    async function sendAudio(blob, mime, mode) {
      const dataBase64 = await blobToBase64(blob)
      const payload = { dataBase64, mimeType: mime, mode }
      const contextWords = extractContextKeywords()
      if (contextWords && contextWords.length > 0) payload.contextWords = contextWords
      const res = await fetch('/dsh-voice/transcribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      let parsed = null
      try { parsed = await res.json() } catch (e) { /* not json */ }
      if (!res.ok || !parsed || !parsed.ok) {
        throw new Error((parsed && parsed.error && parsed.error.message) || `HTTP ${res.status}`)
      }
      if (parsed.command) return { command: parsed.command, text: '' }
      return { text: String(parsed.text || '').trim(), command: null }
    }

    function tidyPhrase(text) {
      let s = String(text || '').trim()
      if (!s) return s
      s = s.replace(/\s*,\s*/g, ', ')
      s = s.replace(/(^|[.!?\n]\s+)([a-zа-яё])/gi, (m, lead, ch) => lead + ch.toUpperCase())
      return s
    }

    // Spoken edit commands (#37): "new line" / "с новой строки" -> \n and so on.
    // Applied before normalization, only when enabled in settings.
    // Russian phrases match RU STT output; English covers EN dictation.
    const VOICE_COMMANDS = [
      [/(^|[\s,.!?])с новой строки([\s,.!?]|$)/gi, '$1\n$2'],
      [/(^|[\s,.!?])новая строка([\s,.!?]|$)/gi, '$1\n$2'],
      [/(^|[\s,.!?])абзац([\s,.!?]|$)/gi, '$1\n\n$2'],
      [/(^|\s)тире(\s|$)/gi, '$1—$2'],
      [/(^|[\s,.!?])new line([\s,.!?]|$)/gi, '$1\n$2'],
      [/(^|[\s,.!?])paragraph([\s,.!?]|$)/gi, '$1\n\n$2'],
    ]

    function applyVoiceCommands(text) {
      let s = text
      for (const [re, to] of VOICE_COMMANDS) s = s.replace(re, to)
      return s.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/[ \t]+/g, ' ').trim()
    }

    // Insert history for undo (#29-9). Browser-only storage.
    const insertHistory = []

    async function undoLastInsert() {
      const last = insertHistory.pop()
      if (!last) return t('nothingToUndo')
      const actions = voice.inputActions
      if (!actions || typeof actions.setDraft !== 'function') return t('composerUnavailable')
      const draft = voice.input && typeof voice.input.draft === 'string' ? voice.input.draft : ''
      if (draft === last.after) actions.setDraft(last.before)
      else {
        // Draft was edited manually — cut the last insert as a substring.
        const i = draft.lastIndexOf(last.added)
        if (i < 0) { insertHistory.push(last); return t('nothingToUndo') }
        actions.setDraft((draft.slice(0, i) + draft.slice(i + last.added.length)).replace(/\s+$/, ''))
      }
      return t('undone')
    }

    function appendDraft(text) {
      const actions = voice.inputActions
      if (!actions || typeof actions.setDraft !== 'function') {
        voice.set({ phase: 'error', error: t('composerUnavailable') })
        return
      }
      let clean = voice.settings.voiceCommands ? applyVoiceCommands(text) : tidyPhrase(text)
      if (!clean) return
      const draft = voice.input && typeof voice.input.draft === 'string' ? voice.input.draft : ''
      const before = draft
      actions.setDraft(draft ? draft + ' ' + clean : clean)
      const limit = Number(voice.settings.historyLimit)
      if (limit > 0) {
        insertHistory.push({ before, added: draft ? ' ' + clean : clean, after: draft ? draft + ' ' + clean : clean })
        while (insertHistory.length > limit) insertHistory.shift()
      }
    }

    // Human-readable key name.
    const KEY_LABELS = {
      Control: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Meta: 'Win',
      Escape: 'Esc',
    }

    function keyLabel(name) {
      if (!name) return t('keyUnset')
      if (name === 'Space') return t('keySpace')
      if (KEY_LABELS[name]) return KEY_LABELS[name]
      // Drop the Key/Digit prefix from codes like KeyR and Digit5.
      return String(name).replace(/^Key/, '').replace(/^Digit/, '')
    }

    // What to store on key press. Pure modifiers are remembered by name:
    // left and right have different codes but the user means "either".
    function keyFromEvent(event) {
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return event.key
      if (event.code) return event.code
      return event.key || ''
    }

    // Announce that the user started speaking.
    //
    // Playback should mute immediately: listening and talking at once is
    // impossible. There is no plugin-to-plugin API — this broadcasts a window
    // event that anyone may hear, so either side works alone.
    function announceVoice(phase) {
      try {
        window.dispatchEvent(new CustomEvent('dsh-voice:speaking', { detail: { phase } }))
      } catch (noEvents) { /* no window — nobody to hear it */ }
      if (voice.settings.beep) playBeep(phase === 'start' ? 880 : 660)
    }

    // Short WebAudio beep so start/stop is audible without looking (#29-6).
    function playBeep(freq) {
      try {
        const AC = typeof AudioContext !== 'undefined' ? AudioContext
          : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null)
        if (!AC) return
        const ac = new AC()
        const osc = ac.createOscillator()
        const gain = ac.createGain()
        osc.frequency.value = freq
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.12, ac.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.09)
        osc.connect(gain); gain.connect(ac.destination)
        osc.start(); osc.stop(ac.currentTime + 0.1)
        osc.onended = () => { try { ac.close() } catch (e) { /* already closed */ } }
      } catch (noAudio) { /* no audio — not critical */ }
    }

    // ------------------------------------------------- browser recognition
    //
    // A separate leg unlike the others: the browser recognizes speech itself,
    // nothing is uploaded to the host, no keys are needed, and text appears
    // word by word while you speak.
    //
    // Cost: in Chrome audio goes to Google servers. This provider is never
    // enabled automatically — only when placed explicitly in a chain.
    function speechRecognitionCtor() {
      if (typeof window === 'undefined') return null
      return window.SpeechRecognition || window.webkitSpeechRecognition || null
    }

    function browserRecognitionAvailable() {
      return speechRecognitionCtor() !== null
    }

    /**
     * @param options {{lang: string, continuous: boolean, onInterim, onFinal, onError}}
     * @returns {{stop: Function, abort: Function}}
     */
    function startBrowserRecognition(options) {
      const Ctor = speechRecognitionCtor()
      const recognition = new Ctor()
      recognition.lang = options.lang && options.lang !== 'auto' ? options.lang : 'ru-RU'
      recognition.continuous = options.continuous !== false
      recognition.interimResults = true
      let stopped = false

      recognition.onresult = (event) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const text = String(result[0] && result[0].transcript || '').trim()
          if (!text) continue
          if (result.isFinal) options.onFinal(text)
          else interim += (interim ? ' ' : '') + text
        }
        options.onInterim(interim)
      }
      recognition.onerror = (event) => {
        // no-speech and aborted are normal life, not failures.
        const code = event && event.error
        if (code === 'no-speech' || code === 'aborted') return
        options.onError(code || t('recognitionError'))
      }
      // The browser ends recognition on its own (pauses, timeout). Restart
      // until we stop it, otherwise dictation dies silently on the first pause.
      recognition.onend = () => {
        if (stopped) return
        try { recognition.start() } catch (alreadyRunning) { /* already running */ }
      }

      try { recognition.start() } catch (cannotStart) {
        options.onError(String(cannotStart && cannotStart.message || cannotStart))
      }
      return {
        stop() { stopped = true; try { recognition.stop() } catch (already) { /* already stopped */ } },
        abort() { stopped = true; try { recognition.abort() } catch (already) { /* already stopped */ } },
      }
    }

    // Fetch the mode chain from the host once. Only needed to decide whether

    voice._core = { tidyPhrase, applyVoiceCommands, VOICE_COMMANDS, undoLastInsert, insertHistory }
