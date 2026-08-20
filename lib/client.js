// dsh-voice — клиентская половина (браузер).
//
// Две кнопки в conversation.input.right:
//   микрофон — диктовка: речь режется по паузам, каждый кусок распознаётся и
//              дописывается в строку ввода; отправка остаётся за пользователем;
//   волна    — голосовое: одна запись целиком, после распознавания текст
//              уходит агенту по истечении окна отмены.
//
// Полоска записи живёт в conversation.input.dock, страница настроек — в
// settings.section.

window.__ModuleLoader__.load({
  id: '@goodandready/dsh-voice',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    let React = require('react')

    const NS = 'dsh-voice'

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
      '@keyframes dvo-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}'
    const cssId = 'dsh-voice/client.module.css'
    if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css="' + cssId + '"]')) {
      const tag = document.createElement('style')
      tag.textContent = CSS
      tag.setAttribute('data-plugin', 'dsh-voice')
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
      pending: null,      // {text, leftMs} — окно отмены режима message
      inputActions: null,
      input: null,
      settings: { vadSilenceMs: 700, autoSendMs: 4000 },
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

    async function sendAudio(blob, mime, mode) {
      const dataBase64 = await blobToBase64(blob)
      const res = await fetch('/dsh-voice/transcribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dataBase64, mimeType: mime, mode }),
      })
      let parsed = null
      try { parsed = await res.json() } catch (e) { /* не json */ }
      if (!res.ok || !parsed || !parsed.ok) {
        throw new Error((parsed && parsed.error && parsed.error.message) || `HTTP ${res.status}`)
      }
      return String(parsed.text || '').trim()
    }

    function appendDraft(text) {
      const actions = voice.inputActions
      if (!actions || typeof actions.setDraft !== 'function') {
        voice.set({ phase: 'error', error: 'Композер недоступен' })
        return
      }
      const draft = voice.input && typeof voice.input.draft === 'string' ? voice.input.draft : ''
      actions.setDraft(draft ? draft + ' ' + text : text)
    }

    // ------------------------------------------------------------ recording
    function teardown(rec) {
      if (!rec) return
      try { rec.stream.getTracks().forEach((t) => t.stop()) } catch (e) { /* уже остановлен */ }
      if (rec.audioCtx) { try { rec.audioCtx.close() } catch (e) { /* уже закрыт */ } }
    }

    function waitStop(recorder) {
      return new Promise((resolve) => recorder.addEventListener('stop', resolve, { once: true }))
    }

    async function openMic(mode) {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Микрофон недоступен: нужен HTTPS или localhost')
      }
      if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder не поддерживается браузером')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
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
      // Без timeslice: только тогда каждый stop() даёт самостоятельный webm-файл.
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

    // Режет текущую фразу: останавливает рекордер, отправляет готовый файл и
    // немедленно начинает новую запись тем же рекордером.
    function cutPhrase() {
      const rec = voice.rec
      if (!rec || rec.cutting || rec.closing) return
      rec.cutting = true
      const stopped = waitStop(rec.recorder)
      try { rec.recorder.stop() } catch (e) { /* уже остановлен */ }
      stopped.then(async () => {
        const blob = new Blob(rec.chunks, { type: rec.mime })
        rec.chunks = []
        rec.silenceMs = 0
        rec.hadSpeech = false
        if (!rec.closing) {
          try { rec.recorder.start() } catch (e) { /* поток закрылся */ }
        }
        rec.cutting = false
        if (blob.size < 1200) return       // слишком короткий кусок — это не речь
        try {
          const text = await sendAudio(blob, rec.mime, 'dictation')
          if (text) appendDraft(text)
        } catch (e) {
          voice.set({ error: String(e && e.message ? e.message : e) })
        }
      })
    }

    function startRecording(mode) {
      if (voice.phase !== 'idle' && voice.phase !== 'error') return
      voice.set({ phase: 'recording', mode, error: '', levels: [] })
      openMic(mode)
        .then((rec) => { voice.rec = rec; voice.notify() })
        .catch((err) => voice.set({ phase: 'error', error: String(err && err.message ? err.message : err), rec: null }))
    }

    function startDictation() { startRecording('dictation') }
    function startMessage() { startRecording('message') }

    function cancelCurrent() {
      const rec = voice.rec
      voice.pending = null
      if (!rec) { voice.set({ phase: 'idle', error: '' }); return }
      rec.closing = true
      const stopped = waitStop(rec.recorder)
      try { rec.recorder.stop() } catch (e) { /* уже остановлен */ }
      stopped.then(() => { teardown(rec); voice.rec = null; voice.set({ phase: 'idle', error: '' }) })
    }

    // Останов по второму нажатию: диктовка досылает хвост, голосовое —
    // отправляет всю запись и открывает окно отмены.
    function stopCurrent() {
      const rec = voice.rec
      if (!rec || rec.closing) return
      rec.closing = true
      const mode = rec.mode
      const stopped = waitStop(rec.recorder)
      try { rec.recorder.stop() } catch (e) { /* уже остановлен */ }
      stopped.then(async () => {
        const blob = new Blob(rec.chunks, { type: rec.mime })
        teardown(rec)
        voice.rec = null
        if (blob.size < 1200) { voice.set({ phase: 'idle' }); return }
        voice.set({ phase: 'processing' })
        try {
          const text = await sendAudio(blob, rec.mime, mode)
          if (!text) { voice.set({ phase: 'error', error: 'Речь не распознана' }); return }
          appendDraft(text)
          if (mode === 'message') {
            voice.set({ phase: 'pending', pending: { text: text, leftMs: voice.settings.autoSendMs } })
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
      if (actions && typeof actions.submit === 'function') {
        setTimeout(() => { try { actions.submit() } catch (e) { /* композер занят */ } }, 0)
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
          title: err ? v.error : 'Голосовой набор', onClick: startDictation,
        }, micIcon()),
        React.createElement('button', {
          type: 'button', className: 'dvo-btn', 'data-err': err ? '1' : '0',
          title: err ? v.error : 'Голосовое сообщение', onClick: startMessage,
        }, waveIcon()),
      )
    }

    function RecordPill(props) {
      const v = useVoice()
      const canvasRef = React.useRef(null)
      voice.inputActions = props.inputActions
      voice.input = props.input
      const ctx = props.ctx

      // VAD: копим тишину и режем фразу, когда пауза превысила порог.
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
          if (rec.mode === 'dictation' && rec.hadSpeech && rec.silenceMs >= voice.settings.vadSilenceMs) {
            cutPhrase()
          }
        }, tick)
        return () => dispose()
      }, [v.phase])

      // Осциллограмма.
      React.useEffect(() => {
        if (v.phase !== 'recording') return
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
          const midY = h / 2
          for (let i = 0; i < levels.length && i * 7 < w; i++) {
            const level = levels[levels.length - 1 - i]
            const age = i / levels.length
            const x = w - 10 - i * 7
            const hh = Math.max(2.5, level * (h - 6) * 0.5 * (1 - age * 0.35))
            g.globalAlpha = 1 - age * 0.75
            g.fillStyle = voice.waveColor
            g.fillRect(x, midY - hh, 3.5, hh * 2)
          }
          g.globalAlpha = 1
        }, 50)
        return () => dispose()
      }, [v.phase])

      // Окно отмены режима message.
      React.useEffect(() => {
        if (v.phase !== 'pending') return
        const tick = 100
        const dispose = ctx.interval(() => {
          const p = voice.pending
          if (!p) return
          p.leftMs -= tick
          if (p.leftMs <= 0) { submitPending(); return }
          voice.notify()
        }, tick)
        return () => dispose()
      }, [v.phase])

      if (v.phase === 'idle') return null

      if (v.phase === 'recording') {
        const hint = v.mode === 'dictation' ? 'Диктовка — текст дописывается в строку' : 'Запись голосового'
        return React.createElement('div', { className: 'dvo-pill' },
          React.createElement('button', { type: 'button', className: 'dvo-pbtn', title: 'Отмена', onClick: cancelCurrent }, xIcon()),
          React.createElement('canvas', { className: 'dvo-wave', ref: canvasRef, width: 720, height: 40 }),
          React.createElement('span', { className: 'dvo-status' }, hint),
          React.createElement('button', { type: 'button', className: 'dvo-pbtn', title: 'Стоп', onClick: stopCurrent }, stopIcon()),
        )
      }

      if (v.phase === 'processing') {
        return React.createElement('div', { className: 'dvo-pill' },
          React.createElement('span', { className: 'dvo-status' }, spinIcon(), 'Распознаю…'))
      }

      if (v.phase === 'pending') {
        const left = Math.max(0, Math.ceil((voice.pending ? voice.pending.leftMs : 0) / 1000))
        return React.createElement('div', { className: 'dvo-pill' },
          React.createElement('span', { className: 'dvo-status' }, 'Отправляю агенту через'),
          React.createElement('span', { className: 'dvo-count' }, left + ' с'),
          React.createElement('button', { type: 'button', className: 'dvo-pbtn', title: 'Отменить отправку', onClick: keepPending }, xIcon()),
        )
      }

      return React.createElement('div', { className: 'dvo-pill' },
        React.createElement('span', { className: 'dvo-status dvo-err' }, warnIcon(), v.error),
        React.createElement('button', { type: 'button', className: 'dvo-pbtn', title: 'Скрыть', onClick: () => voice.set({ phase: 'idle', error: '' }) }, xIcon()),
      )
    }

    // --------------------------------------------------------------- slots
    function registerComposer(ctx) {
      ctx.slots.inject('conversation.input.right', () => ctx.slots.register(
        { name: 'conversation.input.right', id: '@goodandready/dsh-voice', order: 6, label: () => 'Голос' },
        (props) => React.createElement(VoiceButtons, { input: props.input, inputActions: props.inputActions }),
      ))
      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
        { name: 'conversation.input.dock', id: 'dsh-voice-rec', order: 0, label: () => 'Запись голоса' },
        (props) => React.createElement(RecordPill, { input: props.input, inputActions: props.inputActions, ctx: ctx }),
      ))
    }

    // ------------------------------------------------------- settings page
    const BUILTIN = ['deepgram', 'groq', 'hf', 'local-whisper']
    const TEMPLATES = ['openai-transcriptions', 'openai-chat-audio']
    const MODEL_HINT = {
      deepgram: 'nova-2', groq: 'whisper-large-v3-turbo',
      hf: 'openai/whisper-large-v3', 'local-whisper': 'задаётся при запуске сервера',
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
      '.dvs-field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary)}' +
      '.dvs-field input,.dvs-field select{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:6px 8px;font-size:13px}' +
      '.dvs-mini{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:6px;width:28px;height:28px;cursor:pointer;flex:none}' +
      '.dvs-save{background:var(--dsw-alias-brand-primary);color:#fff;border:none;border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer}' +
      '.dvs-card{display:flex;flex-direction:column;gap:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:10px}' +
      '.dvs-card input,.dvs-card select{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:6px 8px;font-size:13px}' +
      '.dvs-wait{font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.5;max-width:520px}' +
      '.dvs-ok{font-size:12px;color:var(--dsw-alias-state-success-primary)}' +
      '.dvs-bad{font-size:12px;color:var(--dsw-alias-state-error-primary)}'
    const setCssId = 'dsh-voice/settings.module.css'
    if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css="' + setCssId + '"]')) {
      const tag = document.createElement('style')
      tag.textContent = SET_CSS
      tag.setAttribute('data-plugin', 'dsh-voice')
      tag.dataset.pluginCss = setCssId
      document.head.appendChild(tag)
    }

    // Редактор одной цепочки: строки «провайдер + модель» с перестановкой.
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
            placeholder: MODEL_HINT[row.provider] || '', onChange: (e) => change(i, { model: e.target.value }),
          }),
          React.createElement('button', { type: 'button', className: 'dvs-mini', title: 'Выше', disabled: !props.writable, onClick: () => move(i, -1) }, '↑'),
          React.createElement('button', { type: 'button', className: 'dvs-mini', title: 'Ниже', disabled: !props.writable, onClick: () => move(i, 1) }, '↓'),
          React.createElement('button', { type: 'button', className: 'dvs-mini', title: 'Убрать', disabled: !props.writable, onClick: () => remove(i) }, '×'),
        )),
        React.createElement('div', { className: 'dvs-row' },
          React.createElement('button', { type: 'button', className: 'dvs-mini', title: 'Добавить провайдера', disabled: !props.writable, onClick: add }, '+'),
          React.createElement('span', { className: 'dvs-sub' }, 'Порядок сверху вниз — порядок попыток'),
        ),
      )
    }

    // Свои провайдеры: имя, шаблон API, куда ходить и чем авторизоваться.
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
            field(i, row, 'key', 'имя для цепочки'),
            React.createElement('select', {
              value: row.template || 'openai-transcriptions', disabled: !props.writable,
              onChange: (e) => change(i, { template: e.target.value }),
            }, TEMPLATES.map((t) => React.createElement('option', { key: t, value: t }, t))),
            React.createElement('button', {
              type: 'button', className: 'dvs-mini', title: 'Убрать',
              disabled: !props.writable, onClick: () => remove(i),
            }, '\u00d7'),
          ),
          React.createElement('div', { className: 'dvs-row' },
            field(i, row, 'baseURL', 'https://openrouter.ai/api/v1', true),
          ),
          React.createElement('div', { className: 'dvs-row' },
            field(i, row, 'model', 'модель', true),
            field(i, row, 'keyEnv', 'имя ключа'),
          ),
          row.template === 'openai-chat-audio'
            ? React.createElement('div', { className: 'dvs-row' },
              field(i, row, 'prompt', 'указание модели (пусто — встроенное)', true))
            : null,
        )),
        React.createElement('div', { className: 'dvs-row' },
          React.createElement('button', {
            type: 'button', className: 'dvs-mini', title: 'Добавить своего провайдера',
            disabled: !props.writable, onClick: add,
          }, '+'),
          React.createElement('span', { className: 'dvs-sub' },
            'У OpenRouter нет /audio/transcriptions \u2014 там нужен шаблон openai-chat-audio'),
        ),
      )
    }

    function VoiceSection(props) {
      const ctx = props.ctx
      const scope = ctx.settingsScope.bind({ namespace: NS })
      const [snap, setSnap] = React.useState(null)
      const [draft, setDraft] = React.useState(null)
      const [saved, setSaved] = React.useState(false)
      const [err, setErr] = React.useState('')

      React.useEffect(() => {
        let alive = true
        const render = () => { if (alive) setSnap(scope.getSnapshot()) }
        render()
        const off = scope.subscribe(render)
        return () => { alive = false; off() }
      }, [])

      // Снимок приходит со статусом, и он важнее самого значения.
      //   loading      — ответа хоста ещё нет;
      //   unavailable  — хост ответил, но наш namespace ему пока неизвестен:
      //                  так бывает, если страницу открыли в первые секунды
      //                  после старта, пока плагины ещё регистрируются;
      //   ready        — значения на месте.
      // При unavailable поле writable берётся из документа и остаётся true,
      // поэтому без проверки статуса карточка рисует пустую, но с виду рабочую
      // форму — именно так этот баг и выглядел.
      const ready = !!snap && snap.status === 'ready'
      const value = ready && snap.value ? snap.value : {}
      const writable = ready && snap.writable !== false

      // Зеркало настроек в браузере перечитывается только на запись значения и
      // на переподключение; появление namespace таким сигналом не считается.
      // Значит само оно не починится — просим перечитать, пока не готово.
      // Зеркало общее, так что это чинит и остальные разделы настроек.
      React.useEffect(() => {
        if (ready) return undefined
        let tries = 0
        const timer = setInterval(() => {
          if (tries >= 15) { clearInterval(timer); return }
          tries += 1
          try { ctx.settingsScope.describe().load() } catch (e) { /* сервис ещё не поднялся */ }
        }, 1000)
        return () => clearInterval(timer)
      }, [ready])

      // Черновик сеем только из готового снимка. Раньше он заполнялся из
      // первого пришедшего, и пустой замораживался навсегда: следующий снимок
      // уже не пересевал его, и карточка оставалась пустой до перезагрузки.
      React.useEffect(() => { if (ready && draft === null) setDraft(JSON.parse(JSON.stringify(value))) }, [ready, draft, value])
      // Клиент должен знать порог VAD и окно отмены — они живут в тех же настройках.
      React.useEffect(() => {
        if (!ready) return
        voice.settings = {
          vadSilenceMs: Number(value && value.dictation && value.dictation.vadSilenceMs) || 700,
          autoSendMs: Number(value && value.message && value.message.autoSendMs) || 4000,
        }
      }, [ready, value])

      if (!ready) {
        const waiting = !snap || snap.status === 'loading'
        return React.createElement('div', { className: 'dvs-wrap' },
          React.createElement('div', { className: 'dvs-wait' }, waiting
            ? 'Загрузка настроек…'
            : 'Харнесс ещё не объявил настройки плагина. Если он только что перезапустился, '
              + 'раздел появится сам через несколько секунд.'),
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
        try {
          for (const k of Object.keys(draft)) await scope.set(k, draft[k])
          voice.settings = {
            vadSilenceMs: Number(draft.dictation && draft.dictation.vadSilenceMs) || 700,
            autoSendMs: Number(draft.message && draft.message.autoSendMs) || 4000,
          }
          setSaved(true); setTimeout(() => setSaved(false), 2000)
        } catch (e) { setErr(String(e && e.message ? e.message : e)) }
      }

      const modeVal = (mode, key, fallback) => {
        const m = draft && draft[mode]
        return m && m[key] !== undefined ? m[key] : fallback
      }

      // Имена своих провайдеров берём из черновика, чтобы только что
      // добавленный сразу появлялся в списках цепочек.
      const chainOptions = BUILTIN.concat(
        (draft && Array.isArray(draft.customProviders) ? draft.customProviders : [])
          .map((c) => String(c && c.key || '').trim())
          .filter((k) => k && BUILTIN.indexOf(k) < 0),
      )

      const langField = (mode) => React.createElement('label', { className: 'dvs-field' }, 'Язык',
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
          React.createElement('div', { className: 'dvs-h' }, 'Голосовой набор'),
          React.createElement('div', { className: 'dvs-sub' }, 'Речь режется по паузам, текст дописывается в строку ввода.'),
          React.createElement(ChainEditor, {
            value: draft && draft.dictation ? draft.dictation.chain : [], writable: writable,
            options: chainOptions,
            onChange: (v) => setIn('dictation', 'chain', v),
          }),
          langField('dictation'),
          numField('dictation', 'vadSilenceMs', 'Пауза до конца фразы, мс', 'Меньше — чаще куски и быстрее текст, но выше риск обрезать слово'),
        ),
        React.createElement('div', { className: 'dvs-block' },
          React.createElement('div', { className: 'dvs-h' }, 'Голосовое сообщение'),
          React.createElement('div', { className: 'dvs-sub' }, 'Одна запись целиком, после распознавания уходит агенту.'),
          React.createElement(ChainEditor, {
            value: draft && draft.message ? draft.message.chain : [], writable: writable,
            options: chainOptions,
            onChange: (v) => setIn('message', 'chain', v),
          }),
          langField('message'),
          numField('message', 'autoSendMs', 'Окно отмены, мс', 'Сколько времени можно отменить автоматическую отправку'),
        ),
        React.createElement('div', { className: 'dvs-block' },
          React.createElement('div', { className: 'dvs-h' }, 'Свои провайдеры'),
          React.createElement('div', { className: 'dvs-sub' },
            'Любой OpenAI-совместимый API. Имя становится доступным в цепочках выше.'),
          React.createElement(CustomEditor, {
            value: draft && draft.customProviders ? draft.customProviders : [], writable: writable,
            onChange: (v) => setTop('customProviders', v),
          }),
        ),
        React.createElement('div', { className: 'dvs-block' },
          React.createElement('div', { className: 'dvs-h' }, 'Общее'),
          textField('whisperUrl', 'Локальный whisper: endpoint', 'POST /inference сервера whisper.cpp'),
          textField('whisperBin', 'Локальный whisper: бинарь', 'используется при автозапуске'),
          textField('whisperModel', 'Локальный whisper: модель', 'используется при автозапуске'),
          React.createElement('label', { className: 'dvs-field' }, 'Автозапуск локального whisper',
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.autoStart), disabled: !writable,
              onChange: (e) => setTop('autoStart', e.target.checked),
            })),
        ),
        React.createElement('div', { className: 'dvs-row' },
          React.createElement('button', { type: 'button', className: 'dvs-save', disabled: !writable, onClick: save }, 'Сохранить'),
          saved ? React.createElement('span', { className: 'dvs-ok' }, 'Сохранено ✓') : null,
          err ? React.createElement('span', { className: 'dvs-bad' }, err) : null,
        ),
      )
    }

    function registerSettings(ctx) {
      ctx.slots.inject('settings.section', () => ctx.slots.register(
        { name: 'settings.section', id: '@goodandready/dsh-voice', order: 30, label: () => 'Голос', inject: () => ({ ctx: ctx }) },
        VoiceSection,
      ))
    }

    exports.inject = ['timer', 'slots', 'settingsScope']
    exports.apply = function apply(ctx) {
      registerComposer(ctx)
      registerSettings(ctx)
    }
    return module.exports
  },
})
