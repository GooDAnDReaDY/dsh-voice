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
      interimTranscript: '', // real-time live preview (ghost text)
      isTtsSpeaking: false,  // turn-taking: true while assistant speech is active
      actionTriggered: null, // 'send' | 'cancel' | 'clear' | 'newline' | null
      inputActions: null,
      input: null,
      settings: {
        vadSilenceMs: 700, autoSendMs: 4000, stream: false, streamChunkMs: 1200, vadAdapt: 0,
        noiseSuppression: true, contextGlossary: true,
        gatedTurnTaking: true, autoSendVisualRing: true, voiceActions: true,
        techJargonCorrection: true, jargonDictionary: [], liveInterimPreview: true,
        structuredPromptVoice: true,
      },
      listeners: new Set(),
      notify() { this.listeners.forEach((l) => l()) },
      set(patch) { Object.assign(this, patch); this.notify() },
      subscribe(l) { this.listeners.add(l); return () => this.listeners.delete(l) },
    }

    function registerGlobalLifecycle() {
      if (typeof window === 'undefined') return () => {}
      const onTtsStart = () => voice.set({ isTtsSpeaking: true })
      const onTtsStop = () => voice.set({ isTtsSpeaking: false })
      const onSettingsSaved = () => { voice._chainsPromise = null }
      const onPageUnload = () => {
        if (voice.rec && typeof voice.teardownRec === 'function') voice.teardownRec(voice.rec)
        if (voice.browser) {
          try { voice.browser.abort() } catch (_) {}
        }
      }

      window.addEventListener('dsh:tts:start', onTtsStart)
      window.addEventListener('dsh:tts:stop', onTtsStop)
      window.addEventListener('dsh-voice:settings-saved', onSettingsSaved)
      window.addEventListener('pagehide', onPageUnload)
      window.addEventListener('beforeunload', onPageUnload)

      return () => {
        voice.disposed = true
        window.removeEventListener('dsh:tts:start', onTtsStart)
        window.removeEventListener('dsh:tts:stop', onTtsStop)
        window.removeEventListener('dsh-voice:settings-saved', onSettingsSaved)
        window.removeEventListener('pagehide', onPageUnload)
        window.removeEventListener('beforeunload', onPageUnload)
        onPageUnload()
        if (typeof voice.clearGlobalHotkey === 'function') voice.clearGlobalHotkey()
        voice.set({ phase: 'idle', caption: '', interimTranscript: '', isTtsSpeaking: false })
      }
    }

    function triggerBargeIn() {
      if (typeof window === 'undefined') return
      try {
        window.dispatchEvent(new CustomEvent('dsh:tts:cancel', { bubbles: true }))
        window.dispatchEvent(new CustomEvent('dsh:tts:stop', { bubbles: true }))
        const audios = document.querySelectorAll('audio')
        for (const a of audios) {
          if (!a.paused) { try { a.pause() } catch (err) { /* best effort audio pause */ } }
        }
      } catch { /* best effort */ }
      voice.set({ isTtsSpeaking: false })
    }

    function findActiveStructuredPrompt() {
      if (typeof document === 'undefined') return null
      try {
        const modal = document.querySelector('.dsh-structured-question, [data-dsh-dialog="question"], .dialog-prompt, .cb-modal-question')
        if (modal) {
          const input = modal.querySelector('textarea, input[type="text"]')
          const buttons = Array.from(modal.querySelectorAll('button:not([disabled])'))
          return { modal, input, buttons }
        }
      } catch { /* best effort */ }
      return null
    }

    function submitToStructuredPrompt(text, promptInfo) {
      if (!promptInfo) return false
      const trimmed = String(text || '').trim().toLowerCase()
      const { buttons, input } = promptInfo
      if (buttons && buttons.length > 0) {
        if (/^(1|первый|first|第一)$/i.test(trimmed) && buttons[0]) { buttons[0].click(); return true }
        if (/^(2|второй|second|第二)$/i.test(trimmed) && buttons[1]) { buttons[1].click(); return true }
        if (/^(3|третий|third|第三)$/i.test(trimmed) && buttons[2]) { buttons[2].click(); return true }
        if (/^(да|yes|ok|confirm|согласен|是|好|确认|同意)$/i.test(trimmed)) {
          const yesBtn = buttons.find((b) => /да|yes|ok|confirm|是|好|确认|同意/i.test(b.textContent || ''))
          if (yesBtn) { yesBtn.click(); return true }
        }
        if (/^(нет|no|отмена|cancel|不|否|取消)$/i.test(trimmed)) {
          const noBtn = buttons.find((b) => /нет|no|cancel|отмена|不|否|取消/i.test(b.textContent || ''))
          if (noBtn) { noBtn.click(); return true }
        }
      }
      if (input) {
        input.value = text
        input.dispatchEvent(new Event('input', { bubbles: true }))
        const form = input.closest('form')
        if (form) {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
        }
        return true
      }
      return false
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
    const chevronIcon = () => (
      ChevronIcon
        ? React.createElement(ChevronIcon, { className: 'dvo-chev-icon' })
        : React.createElement('svg', {
            className: 'dvo-chev-icon',
            width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none',
          },
          React.createElement('path', {
            d: 'M4 6l4 4 4-4', stroke: 'currentColor', strokeWidth: 1.5,
            strokeLinecap: 'round', strokeLinejoin: 'round',
          }))
    )

    function focusComposer() {
      if (typeof window === 'undefined') return
      const actions = voice.inputActions
      if (actions && typeof actions.focus === 'function') {
        try { actions.focus(); return } catch { /* best effort */ }
      }
      try {
        const el = document.querySelector('.conversation-input textarea, .cb-composer textarea, .dsh-composer textarea, [data-slate-editor="true"], textarea')
        if (el && typeof el.focus === 'function') el.focus()
      } catch { /* best effort */ }
    }


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
      const matches = text.match(/[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_]{2,29}/g) || []
      // Linguistic filter: functional stop-word dictionary for vocabulary keyword extraction.
      // Language processing data for context analysis, distinct from user-facing UI text.
      const stop = new Set([
        'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was',
        'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now',
        'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she',
        'too', 'use', 'это', 'как', 'что', 'для', 'или', 'если', 'все', 'при', 'так', 'уже',
        'был', 'быть', 'только', 'тоже', 'под', 'над', 'без', 'нет', 'даже', 'где', 'чем',
      ])
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
      const activeChain = (voice._activeChain || [])
      const gpuIdx = activeChain.indexOf('browser-webgpu')
      const modelMap = voice._activeModelMap || {}
      const chosenModel = modelMap['browser-webgpu'] || (voice.settings && voice.settings.webgpuModel)

      const tryWebGpu = async () => {
        const canGpu = voice.webGpu?.isSupported ? voice.webGpu.isSupported() : (typeof isWebGpuSupported === 'function' && isWebGpuSupported())
        if (canGpu) {
          try {
            const fn = voice.webGpu?.transcribe || transcribeWithWebGpu
            const out = await fn(blob, mime, {
              language: voice._activeLang || (voice.settings && voice.settings.dictation && voice.settings.dictation.language) || '',
              model: chosenModel,
            })
            const text = (out && typeof out.text === 'string') ? tidyPhrase(out.text) : ''
            if (text) return { text, command: null, action: null, provider: 'browser-webgpu' }
          } catch (webGpuErr) {
            console.warn('[dsh-voice] WebGPU Whisper failed:', webGpuErr)
          }
        }
        return null
      }

      const tryHost = async () => {
        const dataBase64 = await blobToBase64(blob)
        const payload = { dataBase64, mimeType: mime, mode }
        const contextWords = extractContextKeywords()
        if (contextWords && contextWords.length > 0) payload.contextWords = contextWords
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
        const timer = controller ? setTimeout(() => controller.abort(), 60000) : null
        let res = null
        try {
          res = await fetch('/dsh-voice/transcribe', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller ? controller.signal : undefined,
          })
        } catch (e) {
          if (e && e.name === 'AbortError') {
            throw new Error('Transcription request timed out (60s)')
          }
          throw e
        } finally {
          if (timer) clearTimeout(timer)
        }
        let parsed = null
        try { parsed = await res.json() } catch (e) { /* not json */ }
        if (!res.ok || !parsed || !parsed.ok) {
          throw new Error((parsed && parsed.error && parsed.error.message) || `HTTP ${res.status}`)
        }
        if (parsed.command) return { command: parsed.command, text: '', action: null }
        return { text: String(parsed.text || '').trim(), command: null, action: parsed.action || null }
      }

      if (gpuIdx === 0) {
        const gpuOut = await tryWebGpu()
        if (gpuOut && gpuOut.text) return gpuOut
        if (activeChain.length > 1) return await tryHost()
        return gpuOut || { text: '', command: null, action: null, provider: 'browser-webgpu' }
      } else if (gpuIdx > 0) {
        try {
          const hostOut = await tryHost()
          if (hostOut && (hostOut.text || hostOut.command || hostOut.action)) return hostOut
        } catch (hostErr) {
          const gpuOut = await tryWebGpu()
          if (gpuOut && gpuOut.text) return gpuOut
          throw hostErr
        }
        const gpuOut = await tryWebGpu()
        if (gpuOut && gpuOut.text) return gpuOut
        return { text: '', command: null, action: null }
      }

      return await tryHost()
    }

    function tidyPhrase(text) {
      if (!text) return ''
      if (/^\n+$/.test(text)) return text
      const lead = (text.match(/^\n+/) || [''])[0]
      const trail = (text.match(/\n+$/) || [''])[0]
      let s = String(text).trim()
      if (!s) return lead || trail || ''
      s = s.replace(/\s*,\s*/g, ', ')
      s = s.replace(/(^|[.!?\n]\s+)([a-zа-яё])/gi, (m, l, ch) => l + ch.toUpperCase())
      return lead + s + trail
    }

    // Functional speech edit commands (#37): spoken line breaks and punctuation -> symbols.
    // Linguistic data for audio transcript post-processing; not user-facing UI text.
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
      if (/^\n+$/.test(s)) return s
      const lead = (s.match(/^\n+/) || [''])[0]
      const trail = (s.match(/\n+$/) || [''])[0]
      const trimmed = s.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/[ \t]+/g, ' ').trim()
      if (!trimmed) return lead || trail || ''
      return lead + trimmed + trail
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
        const spliced = draft.slice(0, i) + draft.slice(i + last.added.length)
        actions.setDraft(spliced.replace(/[ \t]{2,}/g, ' ').replace(/\s+$/, '').trimStart())
      }
      return t('undone')
    }

    function insertDraftText(text) {
      if (voice.disposed) return false
      const actions = voice.inputActions
      if (!actions || (typeof actions.setDraft !== 'function' && typeof actions.insertText !== 'function')) {
        voice.set({ phase: 'error', error: t('composerUnavailable') })
        return false
      }
      if (typeof actions.insertText === 'function') {
        try { actions.insertText(text); return true } catch (_) {}
      }
      const draft = voice.input && typeof voice.input.draft === 'string' ? voice.input.draft : ''
      const before = draft
      const sep = (!draft || draft.endsWith('\n') || text.startsWith('\n')) ? '' : ' '
      const after = draft + sep + text
      actions.setDraft(after)
      const limit = Number(voice.settings.historyLimit)
      if (limit > 0) {
        insertHistory.push({ before, added: sep + text, after })
        while (insertHistory.length > limit) insertHistory.shift()
      }
      return true
    }

    function appendDraft(text) {
      if (voice.disposed || !text) return
      let clean = voice.settings.voiceCommands ? applyVoiceCommands(text) : tidyPhrase(text)
      if (!clean) return
      insertDraftText(clean)
    }

    // Human-readable key name.
    const KEY_LABELS = {
      Control: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Meta: 'Win',
      Escape: 'Esc',
    }

    function keyLabel(name) {
      if (!name) return t('keyUnset')
      if (typeof name === 'string' && name.includes('+')) {
        return name.split('+').map((p) => keyLabel(p)).join(' + ')
      }
      if (name === 'Space') return t('keySpace')
      if (KEY_LABELS[name]) return KEY_LABELS[name]
      // Drop the Key/Digit prefix from codes like KeyR and Digit5.
      return String(name).replace(/^Key/, '').replace(/^Digit/, '')
    }

    // What to store on key press. Pure modifiers are remembered by name:
    // left and right have different codes but the user means "either".
    // Supports combos like Control+Space or Alt+KeyV.
    function keyFromEvent(event) {
      if (!event) return ''
      const modifiers = []
      if (event.ctrlKey && event.key !== 'Control') modifiers.push('Control')
      if (event.altKey && event.key !== 'Alt') modifiers.push('Alt')
      if (event.shiftKey && event.key !== 'Shift') modifiers.push('Shift')
      if (event.metaKey && event.key !== 'Meta') modifiers.push('Meta')

      const main = ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)
        ? event.key
        : (event.code || event.key || '')

      if (modifiers.length > 0 && !['Control', 'Alt', 'Shift', 'Meta'].includes(main)) {
        return modifiers.concat(main).join('+')
      }
      return main
    }

    function hotkeyMatches(event, name) {
      if (!event || !name) return false
      if (typeof name === 'string' && name.includes('+')) {
        const parts = name.split('+')
        const main = parts[parts.length - 1]
        const needCtrl = parts.includes('Control')
        const needAlt = parts.includes('Alt')
        const needShift = parts.includes('Shift')
        const needMeta = parts.includes('Meta')
        if (needCtrl && !event.ctrlKey) return false
        if (needAlt && !event.altKey) return false
        if (needShift && !event.shiftKey) return false
        if (needMeta && !event.metaKey) return false
        return event.code === main || event.key === main
      }
      if (name === 'Control') return event.key === 'Control'
      if (name === 'Alt') return event.key === 'Alt'
      if (name === 'Shift') return event.key === 'Shift'
      if (name === 'Meta') return event.key === 'Meta'
      return event.code === name || event.key === name
    }

    function isAllowedInEditable(name) {
      if (!name) return false
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(name)) return true
      if (/^F\d{1,2}$/.test(name)) return true
      if (typeof name === 'string' && name.includes('+')) return true
      if (['Tab', 'Pause', 'ScrollLock', 'Insert'].includes(name)) return true
      return false
    }

    function isHotkeyRelease(event, name) {
      if (!event || !name) return false
      if (typeof name === 'string' && name.includes('+')) {
        const parts = name.split('+')
        if (event.code === parts[parts.length - 1] || event.key === parts[parts.length - 1]) return true
        for (let i = 0; i < parts.length - 1; i++) {
          if (event.key === parts[i] || event.code === parts[i]) return true
        }
        return false
      }
      return event.code === name || event.key === name
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

    function resolveBrowserRecognitionLang(lang) {
      if (lang && lang !== 'auto') {
        if (lang.includes('-')) return lang
        const BCP47 = { ru: 'ru-RU', en: 'en-US', zh: 'zh-CN', uk: 'uk-UA', de: 'de-DE' }
        return BCP47[lang.toLowerCase()] || lang
      }
      if (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) {
        return document.documentElement.lang
      }
      if (typeof navigator !== 'undefined' && navigator.language) {
        return navigator.language
      }
      return 'en-US'
    }

    /**
     * @param options {{lang: string, continuous: boolean, onInterim, onFinal, onError}}
     * @returns {{stop: Function, abort: Function}}
     */
    function startBrowserRecognition(options) {
      const Ctor = speechRecognitionCtor()
      const recognition = new Ctor()
      recognition.lang = resolveBrowserRecognitionLang(options.lang)
      recognition.continuous = options.continuous !== false
      recognition.interimResults = true
      let stopped = false
      let stopPromise = null
      let resolveStop = null

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
        stopped = true
        try { recognition.abort() } catch (_) {}
        if (resolveStop) { resolveStop(); resolveStop = null }
        options.onError(code || t('recognitionError'))
      }
      // The browser ends recognition on its own (pauses, timeout). Restart
      // until we stop it, otherwise dictation dies silently on the first pause.
      recognition.onend = () => {
        if (stopped) {
          if (resolveStop) { resolveStop(); resolveStop = null }
          return
        }
        try { recognition.start() } catch (alreadyRunning) { /* already running */ }
      }

      try { recognition.start() } catch (cannotStart) {
        options.onError(String(cannotStart && cannotStart.message || cannotStart))
      }
      return {
        stop() {
          if (stopPromise) return stopPromise
          stopped = true
          stopPromise = new Promise((resolve) => {
            resolveStop = resolve
            try { recognition.stop() } catch (already) { resolve() }
            setTimeout(resolve, 800)
          })
          return stopPromise
        },
        abort() {
          stopped = true
          if (resolveStop) { resolveStop(); resolveStop = null }
          try { recognition.abort() } catch (already) { /* already stopped */ }
        },
      }
    }

    // Fetch the mode chain from the host once. Only needed to decide whether

    voice._core = { tidyPhrase, applyVoiceCommands, VOICE_COMMANDS, undoLastInsert, insertHistory, insertDraftText, appendDraft, resolveBrowserRecognitionLang }
