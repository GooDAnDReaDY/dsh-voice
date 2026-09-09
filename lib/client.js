// dsh-voice — client half (browser).
//
// Two buttons in conversation.input.right:
//   mic  — dictation: speech is cut on pauses, each chunk is recognized and
//          appended to the composer; send stays with the user;
//   wave — voice message: one whole recording; after recognition the text is
//          sent to the agent when the cancel window expires.
//
// The recording pill lives in conversation.input.dock; settings are a card
// in settings.plugin.item.

window.__ModuleLoader__.load({
  id: '@goodandready/dsh-voice',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    let React = require('react')

    const NS = 'dsh-voice'

    // UI strings live in the locale registry so a separate package can
    // translate them without touching this plugin. English is the source
    // language, the default, and the fallback.
    const en = {
      'saveFailed': 'Some fields were not saved —',
      'cardHint': 'Dictation and voice messages: providers, chains, local whisper',
      'expand': 'Expand',
      'collapse': 'Collapse',
      'composerUnavailable': 'Composer unavailable',
      'keySpace': 'Space',
      'keyUnset': 'not set',
      'recognitionError': 'recognition failed',
      'micUnavailable': 'Microphone unavailable: needs HTTPS or localhost',
      'noRecorder': 'MediaRecorder is not supported by this browser',
      'browserFailed': 'Browser did not recognize: ',
      'nothingHeard': 'Nothing was recognized',
      'dictationBtn': 'Voice typing',
      'messageBtn': 'Voice message — click or hold',
      'dictationPill': 'Dictation — text is appended to the input',
      'messagePill': 'Recording a voice message',
      'cancel': 'Cancel',
      'holdHint': 'Hold — release to send',
      'listening': 'Listening in the browser…',
      'stop': 'Stop',
      'transcribing': 'Transcribing…',
      'sendingIn': 'Sending to the agent in',
      'secondsShort': ' s',
      'keepPending': 'Do not send',
      'hide': 'Hide',
      'title': 'Voice',
      'recordSlot': 'Voice recording',
      'browserHint': 'the browser does the recognition, no key needed',
      'openaiHint': 'whisper-1 · key OPENAI_API_KEY',
      'siliconflowHint': 'FunAudioLLM/SenseVoiceSmall · key SILICONFLOW_API_KEY',
      'deepinfraHint': 'openai/whisper-large-v3-turbo · key DEEPINFRA_API_KEY',
      'fireworksHint': 'whisper-v3-turbo · key FIREWORKS_API_KEY',
      'mistralHint': 'voxtral-mini-latest · key MISTRAL_API_KEY',
      'openrouterHint': 'google/gemini-2.5-flash · key OPENROUTER_API_KEY',
      'localHint': 'set when the server is started',
      'up': 'Up',
      'down': 'Down',
      'remove': 'Remove',
      'addProvider': 'Add provider',
      'chainHint': 'Top to bottom is the order they are tried in',
      'customName': 'name used in the chain',
      'customModel': 'model',
      'customKeyName': 'key name',
      'customModelHint': 'model to request (empty means the built-in one)',
      'addCustom': 'Add your own provider',
      'loadingSettings': 'Loading settings…',
      'notReady1': 'The harness has not announced this plugin’s settings yet. If it has just restarted, ',
      'notReady2': 'the section will appear on its own in a few seconds.',
      'hotkey': 'Voice message key',
      'pressKey': 'Press a key…',
      'clearKey': 'Clear the key',
      'hotkeyHint1': 'Hold it to record, release to send to the agent, Esc cancels. ',
      'hotkeyHint2': 'Any key will do: a letter, an F-key or a modifier.',
      'language': 'Language',
      'dictationHint': 'Speech is cut at pauses and the text is appended to the input.',
      'pauseMs': 'Pause that ends a phrase, ms',
      'pauseHint': 'Lower means more frequent chunks and faster text, but a higher risk of cutting a word',
      'speaking': 'You are speaking…',
      'silence': 'Pause…',
      'normalizeTranscript': 'Normalize file transcripts',
      'undo': 'Undo last insert',
      'undone': 'Insert undone',
      'nothingToUndo': 'Nothing to undo',
      'beep': 'Beep on start/stop',
      'localOnly': 'Local whisper only',
      'localOnlyHint': 'Restrict both chains to the local whisper.cpp server: fully offline.',
      'sendDelay': 'Dictation send delay (ms)',
      'sendDelayHint': 'Wait before appending a dictated phrase, with a cancel window. 0 = off',
      'mic': 'Microphone',
      'micDefault': 'System default',
      'vocabulary': 'Custom vocabulary (one word per line)',
      'polish': 'Polish transcript with model',
      'polishHint': 'Fix punctuation and fillers via the harness model before inserting',
      'stream': 'Continuous dictation',
      'streamHint': 'Cut phrases by a timer while you speak instead of waiting for a long pause',
      'streamChunkMs': 'Stream chunk (ms)',
      'vadAdapt': 'Adaptive silence',
      'vadAdaptHint': 'Auto-tune the silence threshold to the pace of your speech. 0 = fixed',
      'wakeWord': 'Wake word',
      'wakeWordHint': 'Browser recognition starts recording when speech begins with this phrase. Empty = off',
      'bargeIn': 'Barge-in',
      'polishSend': 'Polish whole draft before sending',
      'polishSendHint': 'Run the composed draft through the model right before sending',
      'sessionCommands': 'Voice session commands',
      'sessionCommandsHint': '"send", "cancel", "stop", "continue" act on the session instead of becoming text',
      'polishBaseUrl': 'Offline polish endpoint',
      'polishBaseUrlHint': 'OpenAI-compatible /chat/completions base URL, e.g. a local Ollama. Empty = harness model',
      'polishModel': 'Offline polish model',
      'polishKeyEnv': 'Offline polish key credential',
      'voiceCommandsLabel': 'Voice edit commands ("new line", "paragraph")',
      'normalizeTranscriptHint': 'transcribe_audio: spoken numbers to digits, tidy punctuation',
      'messageTitle': 'Voice message',
      'messageHint': 'One whole recording, sent to the agent once it is transcribed.',
      'undoMs': 'Undo window, ms',
      'undoHint': 'How long the automatic send can still be called off',
      'customTitle': 'Your own providers',
      'customHint': 'Any OpenAI-compatible API. The name becomes available in the chains above.',
      'general': 'General',
      'whisperEndpoint': 'Local whisper: endpoint',
      'whisperEndpointHint': 'POST /inference of a whisper.cpp server',
      'deepgramEndpoint': 'Deepgram: base URL',
      'deepgramEndpointHint': 'Base URL for Deepgram or self-hosted deployment (default https://api.deepgram.com)',
      'whisperBin': 'Local whisper: binary',
      'whisperBinHint': 'used when autostart is on',
      'whisperModel': 'Local whisper: model',
      'whisperModelHint': 'Absolute path to the ggml model file',
      'whisperAutostart': 'Autostart the local whisper',
      'save': 'Save',
      'saved': 'Saved ✓',
      'openrouterWarning': 'OpenRouter has no /audio/transcriptions \u2014 use the openai-chat-audio template there',
      'noiseSuppression': 'Hardware noise suppression',
      'noiseSuppressionHint': 'Enable browser noise suppression, echo cancellation, and auto gain control',
      'contextGlossary': 'Context glossary injection',
      'contextGlossaryHint': 'Auto-extract code identifiers and terms from composer to improve STT accuracy',
      'providerDashboard': 'Provider Latency & Health',
      'avgLatency': 'Avg latency',
      'successRate': 'Success',
      'fast': 'Fast',
      'normal': 'Normal',
      'slow': 'Slow',
      'error': 'Error',
      'idle': 'No calls',
      'play': 'Play',
      'pause': 'Pause',
      'listenBack': 'Listen back',
      'lastRecording': 'Last voice note',
      'sensevoiceHint': 'SenseVoice-ONNX / Sherpa-ONNX · ultra-fast local STT (~50ms)',
      'sensevoiceEndpoint': 'SenseVoice: endpoint',
      'sensevoiceEndpointHint': 'POST endpoint of sherpa-onnx or compatible server',
      'sensevoiceBin': 'SenseVoice: binary',
      'sensevoiceBinHint': 'used when autostart is on',
      'sensevoiceModel': 'SenseVoice: model path',
      'sensevoiceModelHint': 'Absolute path or identifier of the SenseVoice / sherpa-onnx model',
      'sensevoiceAutostart': 'Autostart the SenseVoice server',
      'visualizerStyle': 'Audio visualizer style',
      'visualizerStyleHint': 'Waveform animation inside the recording pill',
      'visLiquidWave': 'Liquid Wave',
      'visDynamicOrb': 'Dynamic Orb',
      'visBars': 'Classic Bars',
      'visOff': 'Off',
    }

    // Strings are also needed outside components — in recording handlers and
    // slot labels — so the translator is module-level, not only via props.
    let moduleT = (key) => key
    const t = (key) => moduleT(key)

    // ------------------------------------------------------------------ css
    const CSS =
      '.dvo-btn{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0;box-sizing:border-box}' +
      '.dvo-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}' +
      '.dvo-btn[data-err="1"]{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}' +
      '.dvo-pill{display:flex;align-items:center;gap:10px;height:52px;border-radius:26px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);padding:0 14px;width:100%;max-width:720px;margin:0 auto;box-shadow:0 8px 24px rgba(0,0,0,.18);box-sizing:border-box}' +
      '.dvo-pbtn{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;cursor:pointer;padding:0;flex:none;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary)}' +
      '.dvo-pbtn:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dvo-wave{flex:1;height:40px;width:100%;color:var(--dsw-alias-label-primary)}' +
      '.dvo-status{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary);font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dvo-err{color:var(--dsw-alias-state-error-primary)}' +
      '.dvo-count{font-variant-numeric:tabular-nums;font-size:13px;color:var(--dsw-alias-label-secondary)}' +
      '.dvo-spin{animation:dvo-spin 1s linear infinite}' +
      '@keyframes dvo-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}' +
      '.dvo-btn-active{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}' +
      '.dvo-audio-wrap{display:flex;align-items:center;gap:8px;padding:2px 10px;background:var(--dsw-alias-bg-layer-2);border-radius:14px;border:1px solid var(--dsw-alias-border-l1)}' +
      '.dvo-audio-play{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-1);border:0;cursor:pointer;padding:0}' +
      '.dvo-audio-play:hover{opacity:0.9}' +
      '.dvo-audio-time{font-size:12px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}' +
      '.dvo-dash{display:flex;flex-direction:column;gap:8px;margin-top:8px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px}' +
      '.dvo-dash-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-top:4px}' +
      '.dvo-dash-item{display:flex;flex-direction:column;gap:4px;padding:8px 10px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l1);border-radius:8px}' +
      '.dvo-dash-name{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}' +
      '.dvo-dash-row{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--dsw-alias-label-secondary)}' +
      '.dvo-badge{display:inline-flex;align-items:center;font-size:11px;padding:1px 6px;border-radius:6px;font-weight:600}' +
      '.dvo-badge-fast{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-success-primary);border:1px solid var(--dsw-alias-state-success-primary)}' +
      '.dvo-badge-norm{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-warning-primary);border:1px solid var(--dsw-alias-state-warning-primary)}' +
      '.dvo-badge-slow{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-warning-primary);border:1px solid var(--dsw-alias-border-l2)}' +
      '.dvo-badge-err{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-error-primary);border:1px solid var(--dsw-alias-state-error-primary)}' +
      '.dvo-badge-idle{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}'
    const cssId = 'dsh-voice/client.module.css'
    if (typeof document !== 'undefined' && !document.querySelector('style[data-dsh-plugin="dsh-voice"][data-plugin-css="' + cssId + '"]')) {
      const tag = document.createElement('style')
      tag.textContent = CSS
      tag.setAttribute('data-dsh-plugin', 'dsh-voice')
      tag.dataset.pluginCss = cssId
      document.head.appendChild(tag)
    }

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
      return s.replace(/[ \t]+/g, ' ').trim()
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
    // to use browser recognition or record a file.
    let chainsPromise = null
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

    // ----------------------------------------------------------- components
    function VoiceButtons(props) {
      const v = useVoice()
      voice.inputActions = props.inputActions
      voice.input = props.input
      if (v.phase !== 'idle' && v.phase !== 'error') return null
      const err = v.phase === 'error'
      return React.createElement(React.Fragment, null,
        React.createElement('button', {
          type: 'button', className: 'dvo-btn', 'data-err': err ? '1' : '0',
          title: err ? v.error : t('dictationBtn'), onClick: startDictation,
        }, micIcon()),
        React.createElement('button', {
          type: 'button', className: 'dvo-btn', 'data-err': err ? '1' : '0',
          title: err ? v.error : t('messageBtn'),
          // Hold: record while pressed; leaving the control cancels.
          onPointerDown: (e) => { e.preventDefault(); beginHold('message') },
          onPointerUp: () => endHold(false),
          onPointerLeave: () => { if (hold.armed) endHold(true) },
        }, waveIcon()),
        voice.lastNote && voice.lastNote.url
          ? React.createElement('button', {
              type: 'button', className: 'dvo-btn' + (voice.showPlayer ? ' dvo-btn-active' : ''),
              title: t('listenBack'),
              onClick: () => voice.set({ showPlayer: !voice.showPlayer }),
            }, playIcon())
          : null,
      )
    }

    // ----------------------------------------------------------- visualizers
    function accentColor(fallback) {
      try {
        const root = document.documentElement
        const s = getComputedStyle(root)
        const pick = s.getPropertyValue('--dsw-alias-state-info-primary').trim()
          || s.getPropertyValue('--dsw-alias-label-primary').trim()
        if (pick) return pick
      } catch (noTheme) { /* canvas-only fallback */ }
      return fallback || voice.waveColor || 'currentColor'
    }
    function softColor(fallback) {
      try {
        const s = getComputedStyle(document.documentElement)
        const pick = s.getPropertyValue('--dsw-alias-bg-layer-3').trim()
          || s.getPropertyValue('--dsw-alias-label-primary').trim()
        if (pick) return pick
      } catch (noTheme) { /* fallback */ }
      return fallback || voice.waveColor || 'currentColor'
    }
    // 1. Liquid Wave: organic multi-layer wave
    function drawLiquidWave(g, w, h, levels, color, time) {
      const midY = h / 2
      const curLevel = levels.length ? levels[levels.length - 1] : 0
      const smoothLevel = Math.max(0.04, Math.min(1, curLevel * 1.6))

      const layers = [
        { amp: smoothLevel * (h * 0.42), freq: 0.024, speed: 0.08, alpha: 0.45 },
        { amp: smoothLevel * (h * 0.36), freq: 0.038, speed: -0.06, alpha: 0.75 },
        { amp: smoothLevel * (h * 0.28), freq: 0.052, speed: 0.11, alpha: 0.95 },
      ]

      for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
        const lyr = layers[layerIdx]
        g.beginPath()
        g.globalAlpha = lyr.alpha

        const grad = g.createLinearGradient(0, 0, w, 0)
        grad.addColorStop(0, color)
        grad.addColorStop(0.5, accentColor(color))
        grad.addColorStop(1, color)
        g.strokeStyle = grad
        g.lineWidth = layerIdx === 2 ? 2.5 : 1.5

        g.moveTo(0, midY)
        const step = 6
        for (let x = 0; x <= w; x += step) {
          const edgeDist = Math.min(x, w - x) / (w * 0.25)
          const envelope = Math.min(1, Math.max(0, edgeDist))
          const phase = time * lyr.speed + x * lyr.freq
          const dy = Math.sin(phase) * lyr.amp * envelope + Math.cos(phase * 0.5) * (lyr.amp * 0.35) * envelope
          g.lineTo(x, midY + dy)
        }
        g.stroke()
      }
      g.globalAlpha = 1
    }

    // 2. Dynamic Orb: interactive pulsing sphere in the center
    function drawDynamicOrb(g, w, h, levels, color, time) {
      const cx = w / 2
      const cy = h / 2
      const curLevel = levels.length ? levels[levels.length - 1] : 0
      const smoothLevel = Math.max(0.05, Math.min(1, curLevel * 2.0))

      g.beginPath()
      g.globalAlpha = 0.25
      g.strokeStyle = color
      g.lineWidth = 1
      g.moveTo(10, cy)
      g.lineTo(cx - 35, cy)
      g.moveTo(cx + 35, cy)
      g.lineTo(w - 10, cy)
      g.stroke()

      const rRing = 14 + smoothLevel * 14 + Math.sin(time * 0.08) * 3
      g.beginPath()
      g.arc(cx, cy, rRing, 0, Math.PI * 2)
      g.strokeStyle = accentColor(color)
      g.globalAlpha = 0.35 + smoothLevel * 0.4
      g.lineWidth = 1.5
      g.stroke()

      if (smoothLevel > 0.25) {
        g.beginPath()
        g.arc(cx, cy, rRing + 7 + Math.cos(time * 0.06) * 4, 0, Math.PI * 2)
        g.strokeStyle = color
        g.globalAlpha = 0.2 + smoothLevel * 0.3
        g.lineWidth = 1
        g.stroke()
      }

      const rCore = 6 + smoothLevel * 8 + Math.sin(time * 0.12) * 1.5
      const radial = g.createRadialGradient(cx, cy, 1, cx, cy, rCore + 4)
      radial.addColorStop(0, softColor(color))
      radial.addColorStop(0.4, accentColor(color))
      radial.addColorStop(1, color)
      g.beginPath()
      g.arc(cx, cy, rCore, 0, Math.PI * 2)
      g.fillStyle = radial
      g.globalAlpha = 0.95
      g.fill()

      g.globalAlpha = 1
    }

    // 3. Classic Bars: classic vertical bars
    function drawClassicBars(g, w, h, levels, color) {
      const midY = h / 2
      for (let i = 0; i < levels.length && i * 7 < w; i++) {
        const level = levels[levels.length - 1 - i]
        const age = i / levels.length
        const x = w - 10 - i * 7
        const hh = Math.max(2.5, level * (h - 6) * 0.5 * (1 - age * 0.35))
        g.globalAlpha = 1 - age * 0.75
        g.fillStyle = color
        g.fillRect(x, midY - hh, 3.5, hh * 2)
      }
      g.globalAlpha = 1
    }

    function RecordPill(props) {
      const v = useVoice()
      const canvasRef = React.useRef(null)
      const audioRef = React.useRef(null)
      const [isPlaying, setIsPlaying] = React.useState(false)
      voice.inputActions = props.inputActions
      voice.input = props.input
      const ctx = props.ctx

      // VAD: accumulate silence and cut the phrase when the pause exceeds the threshold.
      React.useEffect(() => {
        if (v.phase !== 'recording') return
        const tick = 50
        const dispose = ctx.interval(() => {
          const rec = voice.rec
          if (!rec) return
          const level = currentLevel(rec)
          voice.levels.push(level)
          if (voice.levels.length > 150) voice.levels.shift()
          if (level > 0.06) { rec.hadSpeech = true; rec.silenceMs = 0 }
          else if (rec.hadSpeech) rec.silenceMs += tick
          const speaking = level > 0.06
          if (voice.speaking !== speaking) { voice.speaking = speaking; voice.notify() }
          const adapt = Number(voice.settings.vadAdapt) || 0
          let effectiveVad = Number(voice.settings.vadSilenceMs) || 700
          if (adapt > 0 && rec.hadSpeech) {
            // Adaptive threshold (#41): speech density over ~1s (20 samples).
            // Dense speech -> lower threshold (cut more precisely);
            // pause-heavy -> threshold rises toward base (do not cut on breaths).
            const win = voice.levels.slice(-20)
            const density = win.length ? win.filter((v) => v > 0.06).length / win.length : 0
            const k = adapt * (density - 0.5) * 2
            effectiveVad = Math.max(150, Math.round(Number(voice.settings.vadSilenceMs) * (1 - k)))
          }
          // Continuous mode (#40): cut on a timer while speech continues,
          // without waiting for a long pause.
          const stream = !!voice.settings.stream && rec.mode === 'dictation'
          if (stream && rec.hadSpeech && !rec.cutting) {
            rec.streamMs += tick
            const chunk = Number(voice.settings.streamChunkMs) || 1200
            if (rec.streamMs >= chunk) { cutPhrase(); return }
          } else {
            rec.streamMs = 0
          }
          if (rec.mode === 'dictation' && rec.hadSpeech && rec.silenceMs >= effectiveVad) {
            rec.streamMs = 0
            cutPhrase()
          }
        }, tick)
        return () => dispose()
      }, [v.phase])

      // Waveform / visualizer animation.
      React.useEffect(() => {
        if (v.phase !== 'recording') return
        let frame = 0
        const dispose = ctx.interval(() => {
          const canvas = canvasRef.current
          if (!canvas) return
          const g = canvas.getContext('2d')
          const w = canvas.width, h = canvas.height
          g.clearRect(0, 0, w, h)
          if (!voice.waveColor) {
            try { voice.waveColor = getComputedStyle(canvas).color || '#fff' } catch (e) { voice.waveColor = '#fff' }
          }
          const levels = voice.levels
          const style = (voice.settings && voice.settings.visualizerStyle) || 'liquid-wave'
          frame++

          if (style === 'off') {
            g.beginPath()
            g.globalAlpha = 0.25
            g.strokeStyle = voice.waveColor
            g.lineWidth = 1
            g.moveTo(10, h / 2)
            g.lineTo(w - 10, h / 2)
            g.stroke()
            g.globalAlpha = 1
            return
          }

          if (style === 'dynamic-orb') {
            drawDynamicOrb(g, w, h, levels, voice.waveColor, frame)
          } else if (style === 'bars') {
            drawClassicBars(g, w, h, levels, voice.waveColor)
          } else {
            // default: liquid-wave
            drawLiquidWave(g, w, h, levels, voice.waveColor, frame)
          }
        }, 33)
        return () => dispose()
      }, [v.phase])

      // Message-mode cancel window.
      React.useEffect(() => {
        if (v.phase !== 'pending') return
        const tick = 100
        const dispose = ctx.interval(() => {
          const p = voice.pending
          if (!p) return
          if (p.undoOnly) {
            // Undo-only mode (#29-5): when the window expires just hide the
            // panel; the text either stayed or was already undone.
            p.leftMs -= tick
            if (p.leftMs <= 0) voice.set({ phase: 'idle' })
            else voice.notify()
            return
          }
          p.leftMs -= tick
          if (p.leftMs <= 0) { submitPending(); return }
          voice.notify()
        }, tick)
        return () => dispose()
      }, [v.phase])

      if (v.phase === 'idle') {
        if (!voice.showPlayer || !voice.lastNote || !voice.lastNote.url) return null
        return React.createElement('div', { className: 'dvo-pill' },
          React.createElement('div', { className: 'dvo-audio-wrap' },
            React.createElement('button', {
              type: 'button', className: 'dvo-audio-play',
              title: isPlaying ? t('pause') : t('play'),
              onClick: () => {
                const el = audioRef.current
                if (!el) return
                if (el.paused) { el.play().catch(() => {}); setIsPlaying(true) }
                else { el.pause(); setIsPlaying(false) }
              },
            }, isPlaying ? pauseIcon() : playIcon()),
            React.createElement('audio', {
              ref: audioRef, src: voice.lastNote.url,
              onEnded: () => setIsPlaying(false),
              onPause: () => setIsPlaying(false),
              onPlay: () => setIsPlaying(true),
            }),
            React.createElement('span', { className: 'dvo-audio-time' }, t('lastRecording')),
          ),
          React.createElement('span', { className: 'dvo-status' }, voice.lastNote.text || ''),
          React.createElement('button', {
            type: 'button', className: 'dvo-pbtn', title: t('hide'),
            onClick: () => {
              if (audioRef.current) audioRef.current.pause()
              setIsPlaying(false)
              voice.set({ showPlayer: false })
            },
          }, xIcon()),
        )
      }

      if (v.phase === 'recording') {
        const inBrowser = !!voice.browser
        const rec = voice.rec
        const hint = v.mode === 'dictation' ? t('dictationPill') : t('messagePill')
        // Live caption of what is heard right now. Until the browser emits a
        // final chunk the text is interim and changes on screen.
        const caption = voice.caption || (inBrowser ? '' : null)
        return React.createElement('div', { className: 'dvo-pill' },
          React.createElement('button', { type: 'button', className: 'dvo-pbtn', title: t('cancel'), onClick: cancelCurrent }, xIcon()),
          inBrowser
            ? null
            : React.createElement('canvas', { className: 'dvo-wave', ref: canvasRef, width: 720, height: 40 }),
          React.createElement('span', { className: 'dvo-status' },
            caption
              ? caption
              : (voice.holding
                ? t('holdHint')
                : (inBrowser
                  ? t('listening')
                  : (rec && rec.hadSpeech ? (v.speaking ? t('speaking') : t('silence')) : hint)))),
          React.createElement('button', { type: 'button', className: 'dvo-pbtn', title: t('stop'), onClick: stopCurrent }, stopIcon()),
        )
      }

      if (v.phase === 'processing') {
        return React.createElement('div', { className: 'dvo-pill' },
          React.createElement('span', { className: 'dvo-status' }, spinIcon(), t('transcribing')))
      }

      if (v.phase === 'pending') {
        const left = Math.max(0, Math.ceil((voice.pending ? voice.pending.leftMs : 0) / 1000))
        if (voice.pending && voice.pending.undoOnly) {
          // Cancel window for delayed dictation insert (#29-5).
          return React.createElement('div', { className: 'dvo-pill' },
            React.createElement('span', { className: 'dvo-status' }, t('undo'), ': ', left, t('secondsShort')),
            React.createElement('button', {
              type: 'button', className: 'dvo-pbtn', title: t('undo'),
              onClick: async () => {
                const msg = await undoLastInsert()
                voice.set({ phase: 'idle', error: msg === t('undone') ? '' : msg })
              },
            }, xIcon()),
          )
        }
        return React.createElement('div', { className: 'dvo-pill' },
          voice.lastNote && voice.lastNote.url
            ? React.createElement('div', { className: 'dvo-audio-wrap' },
                React.createElement('button', {
                  type: 'button', className: 'dvo-audio-play',
                  title: isPlaying ? t('pause') : t('play'),
                  onClick: () => {
                    const el = audioRef.current
                    if (!el) return
                    if (el.paused) { el.play().catch(() => {}); setIsPlaying(true) }
                    else { el.pause(); setIsPlaying(false) }
                  },
                }, isPlaying ? pauseIcon() : playIcon()),
                React.createElement('audio', {
                  ref: audioRef, src: voice.lastNote.url,
                  onEnded: () => setIsPlaying(false),
                  onPause: () => setIsPlaying(false),
                  onPlay: () => setIsPlaying(true),
                }),
                React.createElement('span', { className: 'dvo-audio-time' }, t('listenBack')),
              )
            : null,
          React.createElement('span', { className: 'dvo-status' }, t('sendingIn')),
          React.createElement('span', { className: 'dvo-count' }, left + t('secondsShort')),
          React.createElement('button', { type: 'button', className: 'dvo-pbtn', title: t('keepPending'), onClick: keepPending }, xIcon()),
        )
      }

      return React.createElement('div', { className: 'dvo-pill' },
        React.createElement('span', { className: 'dvo-status dvo-err' }, warnIcon(), v.error),
        React.createElement('button', { type: 'button', className: 'dvo-pbtn', title: t('hide'), onClick: () => voice.set({ phase: 'idle', error: '' }) }, xIcon()),
      )
    }

    // --------------------------------------------------------------- slots
    function registerComposer(ctx) {
      // The hotkey lives for as long as the plugin is applied and can change
      // without restart: the settings card broadcasts and the composer reloads.
      ctx.effect(() => {
        let dispose = () => {}
        let alive = true

        const reload = () => {
          fetch('/dsh-voice/status', { cache: 'no-store' })
            .then((res) => res.json())
            .then((data) => {
              if (!alive) return
              dispose()
              dispose = () => {}
              const key = data && data.hotkey
              if (key) dispose = installHotkey(ctx, key, 'message')
              // The composer needs fresh settings without opening the card.
              Object.assign(voice.settings, {
                beep: !!(data && data.beep),
                micDeviceId: String((data && data.micDeviceId) || ''),
                historyLimit: Number(data && data.historyLimit),
                voiceCommands: !!(data && data.voiceCommands),
                sendDelayMs: Number(data && data.modes && data.modes.dictation && data.modes.dictation.sendDelayMs) || 0,
                stream: !!(data && data.modes && data.modes.dictation && data.modes.dictation.stream),
                streamChunkMs: Number(data && data.modes && data.modes.dictation && data.modes.dictation.streamChunkMs) || 1200,
                vadAdapt: Number(data && data.modes && data.modes.dictation && data.modes.dictation.vadAdapt) || 0,
                wakeWord: String((data && data.wakeWord) || ''),
                bargeIn: !!(data && data.bargeIn),
                polishSend: !!(data && data.modes && data.modes.message && data.modes.message.polishSend),
                sessionCommands: !!(data && data.modes && data.modes.message && data.modes.message.sessionCommands),
                noiseSuppression: data && data.noiseSuppression !== false,
                contextGlossary: data && data.contextGlossary !== false,
                visualizerStyle: (data && data.visualizerStyle) || 'liquid-wave',
              })
            })
            .catch(() => { /* no host hint — no hotkey */ })
        }

        reload()
        window.addEventListener('dsh-voice:settings-saved', reload)
        return () => {
          alive = false
          window.removeEventListener('dsh-voice:settings-saved', reload)
          dispose()
        }
      }, 'dsh-voice: hold hotkey')

      ctx.slots.inject('conversation.input.right', () => ctx.slots.register(
        { name: 'conversation.input.right', id: '@goodandready/dsh-voice', order: 6, label: () => t('title') },
        (props) => React.createElement(VoiceButtons, { input: props.input, inputActions: props.inputActions }),
      ))
      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
        { name: 'conversation.input.dock', id: 'dsh-voice-rec', order: 0, label: () => t('recordSlot') },
        (props) => React.createElement(RecordPill, { input: props.input, inputActions: props.inputActions, ctx: ctx }),
      ))
    }

    // ------------------------------------------------------- settings page
    const BUILTIN = [
      'browser', 'deepgram', 'groq', 'hf', 'local-whisper', 'sensevoice',
      // Presets: address and model are filled on the host; only a key is needed.
      'openai', 'siliconflow', 'deepinfra', 'fireworks', 'mistral', 'openrouter',
    ]
    const TEMPLATES = ['openai-transcriptions', 'openai-chat-audio']
    // Resolve at render time: t() must not be captured before locale bind.
    const MODEL_HINT_KEYS = {
      browser: 'browserHint',
      openai: 'openaiHint',
      siliconflow: 'siliconflowHint',
      deepinfra: 'deepinfraHint',
      fireworks: 'fireworksHint',
      mistral: 'mistralHint',
      openrouter: 'openrouterHint',
      'local-whisper': 'localHint',
      sensevoice: 'sensevoiceHint',
    }
    const MODEL_HINT_STATIC = {
      deepgram: 'nova-2',
      groq: 'whisper-large-v3-turbo',
      hf: 'openai/whisper-large-v3',
    }
    function modelHint(provider) {
      const key = MODEL_HINT_KEYS[provider]
      if (key) return t(key)
      return MODEL_HINT_STATIC[provider] || ''
    }
    const LANGS = ['auto', 'ru', 'en', 'uk', 'de']

    const SET_CSS =
      '.dvs-wrap{display:flex;flex-direction:column;gap:22px;padding:4px 0;max-width:720px}' +
      '.dvs-block{display:flex;flex-direction:column;gap:10px}' +
      '.dvs-h{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}' +
      '.dvs-sub{font-size:12px;color:var(--dsw-alias-label-secondary)}' +
      '.dvs-row{display:flex;gap:8px;align-items:center}' +
      '.dvs-row select,.dvs-row input{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:6px 8px;font-size:13px}' +
      '.dvs-row .dvs-model{flex:1}' +
      '.dvs-field{display:flex;flex-direction:column;gap:6px;padding:12px 0;font-size:12px;color:var(--dsw-alias-label-secondary)}' +
      '.dvs-field input,.dvs-field select{height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px}' +
      '.dvs-mini{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:6px;width:28px;height:28px;cursor:pointer;flex:none}' +
      '.dvs-save{appearance:none;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font-size:13px;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}' +
      '.dvs-card{display:flex;flex-direction:column;gap:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:10px}' +
      '.dvs-card input,.dvs-card select{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:6px 8px;font-size:13px}' +
      '.dvs-wait{font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.5;max-width:520px}' +
      '.dvs-ok{font-size:12px;color:var(--dsw-alias-state-success-primary)}' +
      '.dvs-bad{font-size:12px;color:var(--dsw-alias-state-error-primary)}' +
      '.dvo-pcard{list-style:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px}' +
      '.dvo-phead{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;display:flex;align-items:center;gap:12px;padding:14px 16px}' +
      '.dvo-pheadtext{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}' +
      '.dvo-ptitle{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}' +
      '.dvo-pdesc{color:var(--dsw-alias-label-secondary);font-size:13px}' +
      '.dvo-pchev{flex:none;display:flex;color:var(--dsw-alias-label-secondary);transition:transform .15s ease}' +
      '.dvo-pcardOpen .dvo-pchev{transform:rotate(180deg)}' +
      '.dvo-pbody{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}'
    const setCssId = 'dsh-voice/settings.module.css'
    if (typeof document !== 'undefined' && !document.querySelector('style[data-dsh-plugin="dsh-voice"][data-plugin-css="' + setCssId + '"]')) {
      const tag = document.createElement('style')
      tag.textContent = SET_CSS
      tag.setAttribute('data-dsh-plugin', 'dsh-voice')
      tag.dataset.pluginCss = setCssId
      document.head.appendChild(tag)
    }

    // One chain editor: provider+model rows with reordering.
    function ChainEditor(props) {
      const rows = Array.isArray(props.value) ? props.value : []
      const change = (i, patch) => {
        const next = rows.map((r, k) => (k === i ? Object.assign({}, r, patch) : r))
        props.onChange(next)
      }
      const move = (i, delta) => {
        const j = i + delta
        if (j < 0 || j >= rows.length) return
        const next = rows.slice()
        const tmp = next[i]; next[i] = next[j]; next[j] = tmp
        props.onChange(next)
      }
      const remove = (i) => props.onChange(rows.filter((_, k) => k !== i))
      const add = () => props.onChange(rows.concat([{ provider: 'local-whisper', model: '' }]))
      const options = Array.isArray(props.options) && props.options.length ? props.options : BUILTIN

      return React.createElement('div', { className: 'dvs-block' },
        rows.map((row, i) => React.createElement('div', { className: 'dvs-row', key: i },
          React.createElement('select', {
            value: row.provider, disabled: !props.writable,
            onChange: (e) => change(i, { provider: e.target.value }),
          }, (options.indexOf(row.provider) < 0 ? options.concat([row.provider]) : options)
            .map((p) => React.createElement('option', { key: p, value: p }, p))),
          React.createElement('input', {
            className: 'dvs-model', value: row.model || '', disabled: !props.writable,
            placeholder: modelHint(row.provider), onChange: (e) => change(i, { model: e.target.value }),
          }),
          React.createElement('button', { type: 'button', className: 'dvs-mini', title: t('up'), disabled: !props.writable, onClick: () => move(i, -1) }, '↑'),
          React.createElement('button', { type: 'button', className: 'dvs-mini', title: t('down'), disabled: !props.writable, onClick: () => move(i, 1) }, '↓'),
          React.createElement('button', { type: 'button', className: 'dvs-mini', title: t('remove'), disabled: !props.writable, onClick: () => remove(i) }, '×'),
        )),
        React.createElement('div', { className: 'dvs-row' },
          React.createElement('button', { type: 'button', className: 'dvs-mini', title: t('addProvider'), disabled: !props.writable, onClick: add }, '+'),
          React.createElement('span', { className: 'dvs-sub' }, t('chainHint')),
        ),
      )
    }

    // Custom providers: name, API template, where to call, how to authorize.
    function CustomEditor(props) {
      const rows = Array.isArray(props.value) ? props.value : []
      const change = (i, patch) => props.onChange(rows.map((r, k) => (k === i ? Object.assign({}, r, patch) : r)))
      const remove = (i) => props.onChange(rows.filter((_, k) => k !== i))
      const add = () => props.onChange(rows.concat([
        { key: '', template: 'openai-transcriptions', baseURL: '', model: '', keyEnv: '', prompt: '' },
      ]))
      const field = (i, row, name, placeholder, wide) => React.createElement('input', {
        className: wide ? 'dvs-model' : '', value: row[name] || '', placeholder: placeholder,
        disabled: !props.writable, onChange: (e) => change(i, { [name]: e.target.value }),
      })

      return React.createElement('div', { className: 'dvs-block' },
        rows.map((row, i) => React.createElement('div', { className: 'dvs-card', key: i },
          React.createElement('div', { className: 'dvs-row' },
            field(i, row, 'key', t('customName')),
            React.createElement('select', {
              value: row.template || 'openai-transcriptions', disabled: !props.writable,
              onChange: (e) => change(i, { template: e.target.value }),
            }, TEMPLATES.map((t) => React.createElement('option', { key: t, value: t }, t))),
            React.createElement('button', {
              type: 'button', className: 'dvs-mini', title: t('remove'),
              disabled: !props.writable, onClick: () => remove(i),
            }, '\u00d7'),
          ),
          React.createElement('div', { className: 'dvs-row' },
            field(i, row, 'baseURL', 'https://openrouter.ai/api/v1', true),
          ),
          React.createElement('div', { className: 'dvs-row' },
            field(i, row, 'model', t('customModel'), true),
            field(i, row, 'keyEnv', t('customKeyName')),
          ),
          row.template === 'openai-chat-audio'
            ? React.createElement('div', { className: 'dvs-row' },
              field(i, row, 'prompt', t('customModelHint'), true))
            : null,
        )),
        React.createElement('div', { className: 'dvs-row' },
          React.createElement('button', {
            type: 'button', className: 'dvs-mini', title: t('addCustom'),
            disabled: !props.writable, onClick: add,
          }, '+'),
          React.createElement('span', { className: 'dvs-sub' },
            t('openrouterWarning')),
        ),
      )
    }

    function VoiceSection(props) {
      const t = (props && props.t) || moduleT
      const ctx = props.ctx
      // On a non-localhost page the kernel disables settings entirely: the
      // shared document is not readable, every section gets "unavailable" and
      // writes are dropped. The server does not share that restriction, and
      // dsh-lanmode rebuilds the same mechanics on the same calls. Prefer its
      // service when installed, otherwise the kernel one (fine on loopback).
      const scope = ((ctx.get && ctx.get('lanSettings')) || ctx.settingsScope).bind({ namespace: NS })
      const [snap, setSnap] = React.useState(null)
      const [draft, setDraft] = React.useState(null)
      const [saved, setSaved] = React.useState(false)
      const [err, setErr] = React.useState('')

      // Hotkey picker: not a name field — press the key you want. Users should
      // not need to know codes like KeyR.
      //
      // Hooks are declared here, above every return: declaring them later
      // would leave fewer hooks on the not-ready branch and React would
      // unmount the section with an error.
      const [catching, setCatching] = React.useState(false)
      React.useEffect(() => {
        if (!catching) return undefined
        const onKey = (event) => {
          event.preventDefault()
          event.stopPropagation()
          if (event.key === 'Escape') { setCatching(false); return }
          const chosen = keyFromEvent(event)
          setDraft((d) => Object.assign({}, d || {}, { hotkey: chosen }))
          setCatching(false)
        }
        document.addEventListener('keydown', onKey, true)
        return () => document.removeEventListener('keydown', onKey, true)
      }, [catching])

      React.useEffect(() => {
        let alive = true
        const render = () => { if (alive) setSnap(scope.getSnapshot()) }
        render()
        const off = scope.subscribe(render)
        return () => { alive = false; off() }
      }, [])

      const [devices, setDevices] = React.useState([])
      React.useEffect(() => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return
        navigator.mediaDevices.enumerateDevices()
          .then((list) => setDevices(list.filter((d) => d.kind === 'audioinput')))
          .catch(() => {})
      }, [])

      // The snapshot carries a status, and status matters more than value.
      //   loading      — no host answer yet;
      //   unavailable  — host answered but does not know this namespace yet
      //                  (page opened in the first seconds while plugins register);
      //   ready        — values are present.
      // At unavailable, writable comes from the document and stays true, so
      // without a status check the card draws an empty but seemingly working
      // form — that is exactly how this bug looked.
      const ready = !!snap && snap.status === 'ready'
      const value = ready && snap.value ? snap.value : {}
      const writable = ready && snap.writable !== false

      // The browser settings mirror reloads only on value writes and
      // reconnect; a new namespace is not such a signal. It will not fix
      // itself — ask it to reload until ready. The mirror is shared, so this
      // also repairs other settings sections.
      React.useEffect(() => {
        if (ready) return undefined
        let tries = 0
        const timer = setInterval(() => {
          if (tries >= 15) { clearInterval(timer); return }
          tries += 1
          try { ((ctx.get && ctx.get('lanSettings')) || ctx.settingsScope).describe().load() } catch (e) { /* service not up yet */ }
        }, 1000)
        return () => clearInterval(timer)
      }, [ready])

      // Seed the draft only from a ready snapshot. Previously it was filled
      // from the first snapshot and an empty draft froze forever: later
      // snapshots did not reseed it and the card stayed empty until reload.
      React.useEffect(() => { if (ready && draft === null) setDraft(JSON.parse(JSON.stringify(value))) }, [ready, draft, value])
      // The client needs the VAD threshold and cancel window from the same settings.
      React.useEffect(() => {
        if (!ready) return
        voice.settings = Object.assign({}, voice.settings, {
          vadSilenceMs: Number(value && value.dictation && value.dictation.vadSilenceMs) || 700,
          autoSendMs: Number(value && value.message && value.message.autoSendMs) || 4000,
          beep: !!(snap && snap.beep),
          micDeviceId: String((snap && snap.micDeviceId) || ''),
          historyLimit: Number(snap && snap.historyLimit),
          voiceCommands: !!(snap && snap.voiceCommands),
          sendDelayMs: Number(value && value.dictation && value.dictation.sendDelayMs) || 0,
          stream: !!(value && value.dictation && value.dictation.stream),
          streamChunkMs: Number(value && value.dictation && value.dictation.streamChunkMs) || 1200,
          vadAdapt: Number(value && value.dictation && value.dictation.vadAdapt) || 0,
          wakeWord: String((snap && snap.wakeWord) || ''),
          bargeIn: !!(snap && snap.bargeIn),
          polishSend: !!(value && value.message && value.message.polishSend),
          sessionCommands: !!(value && value.message && value.message.sessionCommands),
          polishBaseUrl: String((snap && snap.polishBaseUrl) || ''),
          noiseSuppression: value.noiseSuppression !== false,
          contextGlossary: value.contextGlossary !== false,
        })
      }, [ready, value, snap])

      const [statsData, setStatsData] = React.useState({})
      React.useEffect(() => {
        let alive = true
        fetch('/dsh-voice/status', { cache: 'no-store' })
          .then((r) => r.json())
          .then((data) => {
            if (alive && data && data.providerStats) {
              setStatsData(data.providerStats)
            }
          })
          .catch(() => {})
        return () => { alive = false }
      }, [])

      if (!ready) {
        const waiting = !snap || snap.status === 'loading'
        return React.createElement('div', { className: 'dvs-wrap' },
          React.createElement('div', { className: 'dvs-wait' }, waiting
            ? t('loadingSettings')
            : t('notReady1')
              + t('notReady2')),
        )
      }

      const setIn = (mode, key, v) => setDraft((d) => {
        const next = JSON.parse(JSON.stringify(d || {}))
        next[mode] = next[mode] || {}
        next[mode][key] = v
        return next
      })
      const setTop = (key, v) => setDraft((d) => Object.assign({}, d || {}, { [key]: v }))

      const save = async () => {
        setErr(''); setSaved(false)
        if (!draft) return

        // Fields are written one by one. Previously the first failure broke
        // the loop: later fields were never saved, the composer never got the
        // hotkey reload signal, and the button looked like "nothing happens".
        // Now every field is attempted and failures are collected by name.
        const failed = []
        for (const k of Object.keys(draft)) {
          try {
            await scope.set(k, draft[k])
          } catch (e) {
            failed.push(k + ': ' + String(e && e.message ? e.message : e))
          }
        }

        Object.assign(voice.settings, {
          vadSilenceMs: Number(draft.dictation && draft.dictation.vadSilenceMs) || 700,
          autoSendMs: Number(draft.message && draft.message.autoSendMs) || 4000,
          beep: !!draft.beep,
          micDeviceId: String(draft.micDeviceId || ''),
          historyLimit: Number(draft.historyLimit),
          voiceCommands: !!draft.voiceCommands,
          sendDelayMs: Number(draft.dictation && draft.dictation.sendDelayMs) || 0,
          stream: !!(draft.dictation && draft.dictation.stream),
          streamChunkMs: Number(draft.dictation && draft.dictation.streamChunkMs) || 1200,
          vadAdapt: Number(draft.dictation && draft.dictation.vadAdapt) || 0,
          noiseSuppression: draft.noiseSuppression !== false,
          contextGlossary: draft.contextGlossary !== false,
          visualizerStyle: draft.visualizerStyle || 'liquid-wave',
        })
        // The composer owns the hotkey handler — tell it to reload, otherwise
        // a new key only works after a full page reload.
        try { window.dispatchEvent(new CustomEvent('dsh-voice:settings-saved')) } catch (noEvents) { /* nobody */ }

        if (failed.length) { setErr(t('saveFailed') + ' ' + failed.join('; ')); return }
        setSaved(true); setTimeout(() => setSaved(false), 2000)
      }

      const modeVal = (mode, key, fallback) => {
        const m = draft && draft[mode]
        return m && m[key] !== undefined ? m[key] : fallback
      }

      // Custom provider names come from the draft so a just-added entry
      // appears in chain selects immediately.
      const chainOptions = BUILTIN.concat(
        (draft && Array.isArray(draft.customProviders) ? draft.customProviders : [])
          .map((c) => String(c && c.key || '').trim())
          .filter((k) => k && BUILTIN.indexOf(k) < 0),
      )

      const hotkeyField = () => React.createElement('label', { className: 'dvs-field' },
        t('hotkey'),
        React.createElement('div', { className: 'dvs-row' },
          React.createElement('button', {
            type: 'button', className: 'dvs-save', disabled: !writable,
            onClick: () => setCatching(true),
          }, catching ? t('pressKey') : keyLabel(draft && draft.hotkey)),
          React.createElement('button', {
            type: 'button', className: 'dvs-mini', title: t('clearKey'),
            disabled: !writable, onClick: () => setDraft((d) => Object.assign({}, d || {}, { hotkey: '' })),
          }, '×'),
        ),
        React.createElement('span', { className: 'dvs-sub' },
          t('hotkeyHint1')
          + t('hotkeyHint2')))

      const micField = () => React.createElement('label', { className: 'dvs-field' }, t('mic'),
          React.createElement('select', {
            value: String((snap && snap.micDeviceId) || ''), disabled: !writable,
            onChange: (e) => setTop('micDeviceId', e.target.value),
          },
            React.createElement('option', { value: '' }, t('micDefault')),
            devices.map((d) => React.createElement('option', { key: d.deviceId, value: d.deviceId },
              d.label || d.deviceId.slice(0, 12)))))
      const langField = (mode) => React.createElement('label', { className: 'dvs-field' }, t('language'),
        React.createElement('select', {
          value: modeVal(mode, 'language', 'ru'), disabled: !writable,
          onChange: (e) => setIn(mode, 'language', e.target.value),
        }, LANGS.map((o) => React.createElement('option', { key: o, value: o }, o))))

      const numField = (mode, key, label, hint) => React.createElement('label', { className: 'dvs-field' }, label,
        React.createElement('input', {
          type: 'number', value: modeVal(mode, key, ''), disabled: !writable,
          onChange: (e) => setIn(mode, key, Number(e.target.value)),
        }),
        React.createElement('span', { className: 'dvs-sub' }, hint))

      const textField = (key, label, hint) => React.createElement('label', { className: 'dvs-field' }, label,
        React.createElement('input', {
          value: draft && draft[key] !== undefined ? draft[key] : '', disabled: !writable,
          onChange: (e) => setTop(key, e.target.value),
        }),
        React.createElement('span', { className: 'dvs-sub' }, hint))

      return React.createElement('div', { className: 'dvs-wrap' },
        React.createElement('div', { className: 'dvs-block' },
          React.createElement('div', { className: 'dvs-h' }, t('dictationBtn')),
          React.createElement('div', { className: 'dvs-sub' }, t('dictationHint')),
          React.createElement(ChainEditor, {
            value: draft && draft.dictation ? draft.dictation.chain : [], writable: writable,
            options: chainOptions,
            onChange: (v) => setIn('dictation', 'chain', v),
          }),
          langField('dictation'),
          numField('dictation', 'vadSilenceMs', t('pauseMs'), t('pauseHint')),
          numField('dictation', 'sendDelayMs', t('sendDelay'), t('sendDelayHint')),
          React.createElement('label', { className: 'dvs-field' }, t('polish'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.dictation && draft.dictation.polish), disabled: !writable,
              onChange: (e) => setIn('dictation', 'polish', e.target.checked),
            })),
          React.createElement('div', { className: 'dvs-sub' }, t('polishHint')),
          React.createElement('label', { className: 'dvs-field', title: t('wakeWordHint') }, t('wakeWord'),
            React.createElement('input', {
              type: 'text', value: String((snap && snap.wakeWord) || ''), disabled: !writable,
              onChange: (e) => setTop('wakeWord', e.target.value),
            })),
          React.createElement('label', { className: 'dvs-field', title: t('streamHint') }, t('stream'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.dictation && draft.dictation.stream), disabled: !writable,
              onChange: (e) => setIn('dictation', 'stream', e.target.checked),
            })),
          numField('dictation', 'streamChunkMs', t('streamChunkMs'), t('streamHint')),
          React.createElement('label', { className: 'dvs-field', title: t('vadAdaptHint') }, t('vadAdapt'),
            React.createElement('input', {
              type: 'range', min: 0, max: 1, step: 0.1,
              value: Number(draft && draft.dictation && draft.dictation.vadAdapt) || 0, disabled: !writable,
              onChange: (e) => setIn('dictation', 'vadAdapt', Number(e.target.value)),
            })),
        ),
        React.createElement('div', { className: 'dvs-block' },
          React.createElement('div', { className: 'dvs-h' }, t('messageTitle')),
          React.createElement('div', { className: 'dvs-sub' }, t('messageHint')),
          React.createElement(ChainEditor, {
            value: draft && draft.message ? draft.message.chain : [], writable: writable,
            options: chainOptions,
            onChange: (v) => setIn('message', 'chain', v),
          }),
          langField('message'),
          numField('message', 'autoSendMs', t('undoMs'), t('undoHint')),
          React.createElement('label', { className: 'dvs-field' }, t('polish'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.message && draft.message.polish), disabled: !writable,
              onChange: (e) => setIn('message', 'polish', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field', title: t('polishSendHint') }, t('polishSend'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.message && draft.message.polishSend), disabled: !writable,
              onChange: (e) => setIn('message', 'polishSend', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field', title: t('sessionCommandsHint') }, t('sessionCommands'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.message && draft.message.sessionCommands), disabled: !writable,
              onChange: (e) => setIn('message', 'sessionCommands', e.target.checked),
            })),
        ),
        React.createElement('div', { className: 'dvs-block' },
          React.createElement('div', { className: 'dvs-h' }, t('customTitle')),
          React.createElement('div', { className: 'dvs-sub' },
            t('customHint')),
          React.createElement(CustomEditor, {
            value: draft && draft.customProviders ? draft.customProviders : [], writable: writable,
            onChange: (v) => setTop('customProviders', v),
          }),
        ),
        React.createElement('div', { className: 'dvs-block' },
          React.createElement('div', { className: 'dvs-h' }, t('general')),
          hotkeyField(),
          textField('whisperUrl', t('whisperEndpoint'), t('whisperEndpointHint')),
          textField('whisperBin', t('whisperBin'), t('whisperBinHint')),
          textField('whisperModel', t('whisperModel'), t('whisperModelHint')),
          textField('deepgramBaseUrl', t('deepgramEndpoint'), t('deepgramEndpointHint')),
          React.createElement('label', { className: 'dvs-field' }, t('whisperAutostart'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.autoStart), disabled: !writable,
              onChange: (e) => setTop('autoStart', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field', title: t('normalizeTranscriptHint') },
            t('normalizeTranscript'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.normalizeTranscript), disabled: !writable,
              onChange: (e) => setTop('normalizeTranscript', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field' }, t('beep'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.beep), disabled: !writable,
              onChange: (e) => setTop('beep', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field', title: t('localOnlyHint') }, t('localOnly'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.localOnly), disabled: !writable,
              onChange: (e) => setTop('localOnly', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field' }, t('voiceCommandsLabel'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.voiceCommands), disabled: !writable,
              onChange: (e) => setTop('voiceCommands', e.target.checked),
            })),
          micField(),
          React.createElement('label', { className: 'dvs-field', title: t('noiseSuppressionHint') }, t('noiseSuppression'),
            React.createElement('input', {
              type: 'checkbox', checked: draft ? draft.noiseSuppression !== false : true, disabled: !writable,
              onChange: (e) => setTop('noiseSuppression', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field', title: t('contextGlossaryHint') }, t('contextGlossary'),
            React.createElement('input', {
              type: 'checkbox', checked: draft ? draft.contextGlossary !== false : true, disabled: !writable,
              onChange: (e) => setTop('contextGlossary', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field', title: t('visualizerStyleHint') }, t('visualizerStyle'),
            React.createElement('select', {
              value: String((draft && draft.visualizerStyle) || 'liquid-wave'), disabled: !writable,
              onChange: (e) => setTop('visualizerStyle', e.target.value),
            },
              React.createElement('option', { value: 'liquid-wave' }, t('visLiquidWave')),
              React.createElement('option', { value: 'dynamic-orb' }, t('visDynamicOrb')),
              React.createElement('option', { value: 'bars' }, t('visBars')),
              React.createElement('option', { value: 'off' }, t('visOff')),
            )),
          React.createElement('label', { className: 'dvs-field' }, t('vocabulary'),
            React.createElement('textarea', {
              rows: 3, disabled: !writable,
              value: Array.isArray(draft && draft.vocabulary) ? draft.vocabulary.join('\n') : '',
              onChange: (e) => setTop('vocabulary', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean)),
            })),
          React.createElement('label', { className: 'dvs-field', title: t('polishBaseUrlHint') }, t('polishBaseUrl'),
            React.createElement('input', {
              type: 'text', value: String((snap && snap.polishBaseUrl) || ''), disabled: !writable,
              onChange: (e) => setTop('polishBaseUrl', e.target.value),
            })),
          React.createElement('label', { className: 'dvs-field' }, t('polishModel'),
            React.createElement('input', {
              type: 'text', value: String((draft && draft.polishModel) || ''), disabled: !writable,
              onChange: (e) => setTop('polishModel', e.target.value),
            })),
          React.createElement('label', { className: 'dvs-field' }, t('polishKeyEnv'),
            React.createElement('input', {
              type: 'text', value: String((draft && draft.polishKeyEnv) || ''), disabled: !writable,
              onChange: (e) => setTop('polishKeyEnv', e.target.value),
            })),
        ),
        React.createElement('div', { className: 'dvs-block' },
          React.createElement('div', { className: 'dvs-h' }, 'SenseVoice-ONNX / Sherpa-ONNX'),
          React.createElement('div', { className: 'dvs-sub' }, t('sensevoiceHint')),
          textField('sensevoiceUrl', t('sensevoiceEndpoint'), t('sensevoiceEndpointHint')),
          textField('sensevoiceBin', t('sensevoiceBin'), t('sensevoiceBinHint')),
          textField('sensevoiceModel', t('sensevoiceModel'), t('sensevoiceModelHint')),
          React.createElement('label', { className: 'dvs-field' }, t('sensevoiceAutostart'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.sensevoiceAutostart), disabled: !writable,
              onChange: (e) => setTop('sensevoiceAutostart', e.target.checked),
            })),
        ),
        React.createElement('div', { className: 'dvs-block' },
          React.createElement('div', { className: 'dvs-h' }, t('providerDashboard')),
          React.createElement('div', { className: 'dvo-dash' },
            React.createElement('div', { className: 'dvo-dash-grid' },
              Object.keys(statsData).length === 0
                ? React.createElement('div', { className: 'dvs-sub' }, t('idle'))
                : Object.entries(statsData).map(([key, item]) => {
                    const avg = item.avgTookMs || 0
                    const hasErrors = item.failures > 0
                    let badgeClass = 'dvo-badge-idle'
                    let badgeText = t('idle')
                    if (item.attempts > 0) {
                      if (hasErrors && item.successes === 0) {
                        badgeClass = 'dvo-badge-err'
                        badgeText = t('error')
                      } else if (avg > 0 && avg < 400) {
                        badgeClass = 'dvo-badge-fast'
                        badgeText = avg + 'ms · ' + t('fast')
                      } else if (avg >= 400 && avg <= 1500) {
                        badgeClass = 'dvo-badge-norm'
                        badgeText = avg + 'ms · ' + t('normal')
                      } else {
                        badgeClass = 'dvo-badge-slow'
                        badgeText = avg + 'ms · ' + t('slow')
                      }
                    }
                    const rate = item.attempts > 0 ? Math.round((item.successes / item.attempts) * 100) : 100
                    return React.createElement('div', { key, className: 'dvo-dash-item', title: item.lastError ? `Error: ${item.lastError}` : '' },
                      React.createElement('div', { className: 'dvo-dash-name' }, key),
                      React.createElement('div', { className: 'dvo-dash-row' },
                        React.createElement('span', { className: 'dvo-badge ' + badgeClass }, badgeText),
                        React.createElement('span', null, rate + '%'),
                      ),
                      React.createElement('div', { className: 'dvo-dash-row' },
                        React.createElement('span', null, `${item.successes}/${item.attempts}`),
                        React.createElement('span', null, t('successRate')),
                      ),
                    )
                  })
            )
          )
        ),
        React.createElement('div', { className: 'dvs-row' },
          React.createElement('button', { type: 'button', className: 'dvs-save', disabled: !writable, onClick: save }, t('save')),
          saved ? React.createElement('span', { className: 'dvs-ok' }, t('saved')) : null,
          err ? React.createElement('span', { className: 'dvs-bad' }, err) : null,
        ),
      )
    }

    // Card in Settings → Plugins → Plugin settings (#18): the kernel only
    // draws the list shell, so title, hint and collapse are ours.
    // Body mounts on first expand; the settings snapshot arrives then.
    function PluginCard(props) {
      const [open, setOpen] = React.useState(false)
      const tt = (props && props.t) || t
      const title = tt('title')
      return React.createElement('li',
        { className: open ? 'dvo-pcard dvo-pcardOpen' : 'dvo-pcard' },
        React.createElement('button',
          {
            type: 'button', className: 'dvo-phead',
            'aria-expanded': open ? 'true' : 'false',
            'aria-label': (open ? tt('collapse') : tt('expand')) + ': ' + title,
            onClick: () => setOpen((v) => !v),
          },
          React.createElement('span', { className: 'dvo-pheadtext' },
            React.createElement('span', { className: 'dvo-ptitle' }, title),
            React.createElement('span', { className: 'dvo-pdesc' }, tt('cardHint')),
          ),
          React.createElement('span', { className: 'dvo-pchev' }, chevronIcon()),
        ),
        open ? React.createElement('div', { className: 'dvo-pbody' }, React.createElement(VoiceSection, props)) : null,
      )
    }

    function registerSettings(ctx) {
      // Settings card under Settings → Plugins → Plugin settings (#18).
      // The registration key must equal NS (the settings namespace), otherwise
      // the tab silently skips the slot.
      ctx.slots.inject('settings.plugin.item', () => ctx.slots.register(
        {
          name: 'settings.plugin.item',
          key: NS,
          // locale on the slot record is what makes the component receive props.t.
          locale: NS,
          inject: () => ({ ctx: ctx }),
        },
        PluginCard,
      ))
    }

    exports.inject = ['timer', 'slots', 'settingsScope', 'locale']
    exports.apply = function apply(ctx) {
      // English is the source language. Other languages come from the
      // separate translation plugin at runtime. Re-registering the same
      // namespace+language throws, so tolerate a pre-registered dictionary.
      const addLocale = (locale, dictionary) => {
        try {
          return ctx.locale.register(NS, locale, dictionary)
        } catch (alreadyTaken) {
          return () => {}
        }
      }
      ctx.effect(() => {
        const undo = [addLocale('en', en)]
        return () => { for (const off of undo) off() }
      }, 'dsh-voice: locale dictionaries')
      moduleT = ctx.locale.bind(NS)
      registerComposer(ctx)
      registerSettings(ctx)
    }
    return module.exports
  },
})
