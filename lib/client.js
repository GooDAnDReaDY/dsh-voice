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

    // Строки интерфейса живут в реестре локалей: так их переводит отдельный
    // пакет, не трогая код этого плагина. Английский — язык по умолчанию,
    // на него же приходится откат, если перевода нет.
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
      'messageTitle': 'Voice message',
      'messageHint': 'One whole recording, sent to the agent once it is transcribed.',
      'undoMs': 'Undo window, ms',
      'undoHint': 'How long the automatic send can still be called off',
      'customTitle': 'Your own providers',
      'customHint': 'Any OpenAI-compatible API. The name becomes available in the chains above.',
      'general': 'General',
      'whisperEndpoint': 'Local whisper: endpoint',
      'whisperEndpointHint': 'POST /inference of a whisper.cpp server',
      'whisperBin': 'Local whisper: binary',
      'whisperBinHint': 'used when autostart is on',
      'whisperModel': 'Local whisper: model',
      'whisperAutostart': 'Autostart the local whisper',
      'save': 'Save',
      'saved': 'Saved ✓',
      'openrouterWarning': 'OpenRouter has no /audio/transcriptions \u2014 use the openai-chat-audio template there',
    }
    const ru = {
      'saveFailed': 'Часть полей не сохранилась —',
      'cardHint': 'Диктовка и голосовые сообщения: провайдеры, цепочки, локальный whisper',
      'expand': 'Развернуть',
      'collapse': 'Свернуть',
      'composerUnavailable': 'Композер недоступен',
      'keySpace': 'Пробел',
      'keyUnset': 'не задана',
      'recognitionError': 'ошибка распознавания',
      'micUnavailable': 'Микрофон недоступен: нужен HTTPS или localhost',
      'noRecorder': 'MediaRecorder не поддерживается браузером',
      'browserFailed': 'Браузер не распознал: ',
      'nothingHeard': 'Речь не распознана',
      'dictationBtn': 'Голосовой набор',
      'messageBtn': 'Голосовое сообщение — нажать или удерживать',
      'dictationPill': 'Диктовка — текст дописывается в строку',
      'messagePill': 'Запись голосового',
      'cancel': 'Отмена',
      'holdHint': 'Держите — отпустите, чтобы отправить',
      'listening': 'Слушаю в браузере…',
      'stop': 'Стоп',
      'transcribing': 'Распознаю…',
      'sendingIn': 'Отправляю агенту через',
      'secondsShort': ' с',
      'keepPending': 'Отменить отправку',
      'hide': 'Скрыть',
      'title': 'Голос',
      'recordSlot': 'Запись голоса',
      'browserHint': 'распознаёт сам браузер, ключ не нужен',
      'openaiHint': 'whisper-1 · ключ OPENAI_API_KEY',
      'siliconflowHint': 'FunAudioLLM/SenseVoiceSmall · ключ SILICONFLOW_API_KEY',
      'deepinfraHint': 'openai/whisper-large-v3-turbo · ключ DEEPINFRA_API_KEY',
      'fireworksHint': 'whisper-v3-turbo · ключ FIREWORKS_API_KEY',
      'mistralHint': 'voxtral-mini-latest · ключ MISTRAL_API_KEY',
      'openrouterHint': 'google/gemini-2.5-flash · ключ OPENROUTER_API_KEY',
      'localHint': 'задаётся при запуске сервера',
      'up': 'Выше',
      'down': 'Ниже',
      'remove': 'Убрать',
      'addProvider': 'Добавить провайдера',
      'chainHint': 'Порядок сверху вниз — порядок попыток',
      'customName': 'имя для цепочки',
      'customModel': 'модель',
      'customKeyName': 'имя ключа',
      'customModelHint': 'указание модели (пусто — встроенное)',
      'addCustom': 'Добавить своего провайдера',
      'loadingSettings': 'Загрузка настроек…',
      'notReady1': 'Харнесс ещё не объявил настройки плагина. Если он только что перезапустился, ',
      'notReady2': 'раздел появится сам через несколько секунд.',
      'hotkey': 'Клавиша для голосового сообщения',
      'pressKey': 'Нажмите клавишу…',
      'clearKey': 'Убрать клавишу',
      'hotkeyHint1': 'Держите её — идёт запись, отпустите — уйдёт агенту, Esc — отмена. ',
      'hotkeyHint2': 'Можно любую: буква, F-клавиша или модификатор.',
      'language': 'Язык',
      'dictationHint': 'Речь режется по паузам, текст дописывается в строку ввода.',
      'pauseMs': 'Пауза до конца фразы, мс',
      'pauseHint': 'Меньше — чаще куски и быстрее текст, но выше риск обрезать слово',
      'messageTitle': 'Голосовое сообщение',
      'messageHint': 'Одна запись целиком, после распознавания уходит агенту.',
      'undoMs': 'Окно отмены, мс',
      'undoHint': 'Сколько времени можно отменить автоматическую отправку',
      'customTitle': 'Свои провайдеры',
      'customHint': 'Любой OpenAI-совместимый API. Имя становится доступным в цепочках выше.',
      'general': 'Общее',
      'whisperEndpoint': 'Локальный whisper: endpoint',
      'whisperEndpointHint': 'POST /inference сервера whisper.cpp',
      'whisperBin': 'Локальный whisper: бинарь',
      'whisperBinHint': 'используется при автозапуске',
      'whisperModel': 'Локальный whisper: модель',
      'whisperAutostart': 'Автозапуск локального whisper',
      'save': 'Сохранить',
      'saved': 'Сохранено ✓',
      'openrouterWarning': 'У OpenRouter нет /audio/transcriptions \u2014 там нужен шаблон openai-chat-audio',
    }

    // Строки нужны и вне компонентов — в обработчиках записи, в подписях
    // слотов. Поэтому переводчик модульный, а не только через props.
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
        voice.set({ phase: 'error', error: t('composerUnavailable') })
        return
      }
      const draft = voice.input && typeof voice.input.draft === 'string' ? voice.input.draft : ''
      actions.setDraft(draft ? draft + ' ' + text : text)
    }

    // Как клавиша называется на человеческом языке.
    const KEY_LABELS = {
      Control: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Meta: 'Win',
      Space: t('keySpace'), Escape: 'Esc',
    }

    function keyLabel(name) {
      if (!name) return t('keyUnset')
      if (KEY_LABELS[name]) return KEY_LABELS[name]
      // Коды вида KeyR и Digit5 показываем без служебной приставки.
      return String(name).replace(/^Key/, '').replace(/^Digit/, '')
    }

    // Что записать в настройку по нажатию. Чистый модификатор запоминаем по
    // имени: код у левого и правого разный, а человек нажимает «какой-нибудь».
    function keyFromEvent(event) {
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return event.key
      if (event.code) return event.code
      return event.key || ''
    }

    // Объявление о том, что человек заговорил.
    //
    // Нужно, чтобы озвучка немедленно замолчала: слушать ответ и говорить
    // одновременно невозможно, а перекрикивать собственный плагин — глупо.
    // Связи между плагинами нет: голос кричит в окно, кто хочет — слышит.
    // Поэтому оба плагина работают и поодиночке.
    function announceVoice(phase) {
      try {
        window.dispatchEvent(new CustomEvent('dsh-voice:speaking', { detail: { phase } }))
      } catch (noEvents) { /* окна нет — значит и слушать некому */ }
    }

    // ------------------------------------------------- распознавание в браузере
    //
    // Отдельная нога, не похожая на все остальные: речь распознаёт сам браузер,
    // на хост ничего не уходит, ключи не нужны, а текст появляется по словам
    // прямо во время речи.
    //
    // Плата за это: в Chrome звук уходит на серверы Google. Поэтому провайдер
    // никогда не включается сам — только если его прямо поставили в цепочку.
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
        // no-speech и aborted — обычная жизнь, а не поломка.
        const code = event && event.error
        if (code === 'no-speech' || code === 'aborted') return
        options.onError(code || t('recognitionError'))
      }
      // Браузер обрывает распознавание сам: на паузах, по таймауту. Пока нас не
      // остановили — поднимаем заново, иначе диктовка молча умрёт на первой паузе.
      recognition.onend = () => {
        if (stopped) return
        try { recognition.start() } catch (alreadyRunning) { /* уже поднято */ }
      }

      try { recognition.start() } catch (cannotStart) {
        options.onError(String(cannotStart && cannotStart.message || cannotStart))
      }
      return {
        stop() { stopped = true; try { recognition.stop() } catch (already) { /* уже стоит */ } },
        abort() { stopped = true; try { recognition.abort() } catch (already) { /* уже стоит */ } },
      }
    }

    // Какие провайдеры стоят в цепочке режима — узнаём у хоста один раз.
    // Нужно только чтобы понять, идти в браузер или писать файл.
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
      try { rec.stream.getTracks().forEach((t) => t.stop()) } catch (e) { /* уже остановлен */ }
      if (rec.audioCtx) { try { rec.audioCtx.close() } catch (e) { /* уже закрыт */ } }
    }

    function waitStop(recorder) {
      return new Promise((resolve) => recorder.addEventListener('stop', resolve, { once: true }))
    }

    async function openMic(mode) {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(t('micUnavailable'))
      }
      if (typeof MediaRecorder === 'undefined') throw new Error(t('noRecorder'))
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

    // Распознавание браузером вместо записи файла. Возвращает false, если
    // браузер этого не умеет, — тогда идём обычным путём.
    function startBrowserLeg(mode, language) {
      if (!browserRecognitionAvailable()) return false
      const finals = []
      voice.caption = ''
      voice.browser = startBrowserRecognition({
        lang: language,
        continuous: true,
        onInterim: (text) => { voice.caption = text; voice.notify() },
        onFinal: (text) => {
          finals.push(text)
          voice.caption = ''
          // Диктовка дописывает сразу, голосовое копит до отпускания.
          if (mode === 'dictation') appendDraft(text)
          else voice.notify()
        },
        onError: (reason) => {
          // Браузер отказал уже после старта — честно говорим об этом, а не
          // делаем вид, что слушаем.
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
      // Кричим до открытия микрофона, а не после: чем раньше замолчит
      // озвучка, тем меньше её попадёт в запись.
      announceVoice('start')
      voice.set({ phase: 'recording', mode, error: '', levels: [], caption: '' })
      modeChain(mode).then((info) => {
        // Браузерная нога — только если её прямо поставили первой в цепочке.
        if (info.chain[0] === 'browser' && startBrowserLeg(mode, info.language)) return
        openMic(mode)
          .then((rec) => { voice.rec = rec; voice.notify() })
          .catch((err) => voice.set({ phase: 'error', error: String(err && err.message ? err.message : err), rec: null }))
      })
    }

    function startDictation() { startRecording('dictation') }
    function startMessage() { startRecording('message') }

    // --------------------------------------------------------- удержание
    //
    // Два жеста одной кнопкой: короткое нажатие включает запись до второго
    // нажатия (как было), удержание пишет ровно пока держишь. Отпустил — ушло.
    //
    // Различаем по времени: если отпустили раньше порога — это клик.
    const HOLD_THRESHOLD_MS = 350

    const hold = { active: false, mode: null, startedAt: 0, armed: false }

    function beginHold(mode) {
      if (hold.armed || (voice.phase !== 'idle' && voice.phase !== 'error')) return
      hold.armed = true
      hold.mode = mode
      hold.startedAt = Date.now()
      hold.active = false
      // Запись начинаем сразу: ждать порога — значит потерять первое слово.
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
      // Короткое нажатие — это клик: запись уже идёт, оставляем её включённой,
      // остановит второе нажатие.
      if (!cancelled && heldMs < HOLD_THRESHOLD_MS) { voice.notify(); return }
      if (cancelled) cancelCurrent()
      else stopCurrent()
    }

    // Горячая клавиша: держать её удобнее, чем целиться мышью. Пока клавиша
    // зажата — идёт запись, Esc отменяет.
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
        // В поле ввода горячая клавиша-модификатор не мешает: она сама по себе
        // ничего не печатает. А вот обычную букву перехватывать нельзя.
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
      try { rec.recorder.stop() } catch (e) { /* уже остановлен */ }
      stopped.then(() => { teardown(rec); voice.rec = null; voice.set({ phase: 'idle', error: '' }) })
    }

    // Останов по второму нажатию: диктовка досылает хвост, голосовое —
    // отправляет всю запись и открывает окно отмены.
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
          // Диктовка дописывала по ходу — добавлять нечего.
          voice.set({ phase: 'idle' })
        }
        return
      }
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
          if (!text) { voice.set({ phase: 'error', error: t('nothingHeard') }); return }
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
          title: err ? v.error : t('dictationBtn'), onClick: startDictation,
        }, micIcon()),
        React.createElement('button', {
          type: 'button', className: 'dvo-btn', 'data-err': err ? '1' : '0',
          title: err ? v.error : t('messageBtn'),
          // Удержание: пишет, пока держишь; увёл курсор далеко вверх — отмена.
          onPointerDown: (e) => { e.preventDefault(); beginHold('message') },
          onPointerUp: () => endHold(false),
          onPointerLeave: () => { if (hold.armed) endHold(true) },
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
        const inBrowser = !!voice.browser
        const hint = v.mode === 'dictation' ? t('dictationPill') : t('messagePill')
        // Живая подпись: что слышно прямо сейчас. Пока браузер не выдал
        // окончательный кусок, текст черновой и меняется на глазах.
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
                : (inBrowser ? t('listening') : hint))),
          React.createElement('button', { type: 'button', className: 'dvo-pbtn', title: t('stop'), onClick: stopCurrent }, stopIcon()),
        )
      }

      if (v.phase === 'processing') {
        return React.createElement('div', { className: 'dvo-pill' },
          React.createElement('span', { className: 'dvo-status' }, spinIcon(), t('transcribing')))
      }

      if (v.phase === 'pending') {
        const left = Math.max(0, Math.ceil((voice.pending ? voice.pending.leftMs : 0) / 1000))
        return React.createElement('div', { className: 'dvo-pill' },
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
      // Горячая клавиша живёт всё время, пока плагин применён, и меняется без
      // перезапуска: карточка настроек кричит в окно, композер перечитывает.
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
            })
            .catch(() => { /* без подсказки хоста клавиши просто не будет */ })
        }

        reload()
        window.addEventListener('dsh-voice:settings-saved', reload)
        return () => {
          alive = false
          window.removeEventListener('dsh-voice:settings-saved', reload)
          dispose()
        }
      }, 'dsh-voice: горячая клавиша удержания')

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
      'browser', 'deepgram', 'groq', 'hf', 'local-whisper',
      // Заготовки: адрес и модель уже прописаны на хосте, нужен только ключ.
      'openai', 'siliconflow', 'deepinfra', 'fireworks', 'mistral', 'openrouter',
    ]
    const TEMPLATES = ['openai-transcriptions', 'openai-chat-audio']
    const MODEL_HINT = {
      browser: t('browserHint'),
      openai: t('openaiHint'),
      siliconflow: t('siliconflowHint'),
      deepinfra: t('deepinfraHint'),
      fireworks: t('fireworksHint'),
      mistral: t('mistralHint'),
      openrouter: t('openrouterHint'),
      deepgram: 'nova-2', groq: 'whisper-large-v3-turbo',
      hf: 'openai/whisper-large-v3', 'local-whisper': t('localHint'),
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
      // На странице, открытой не с localhost, ядро отключает настройки целиком:
      // общий вид документа не читается, каждый раздел получает "unavailable",
      // запись выбрасывается. Сервер это ограничение не разделяет, и плагин
      // dsh-lanmode поднимает ту же механику поверх тех же вызовов. Если он
      // установлен — берём его службу, иначе ядровую: на loopback-странице она
      // работает штатно.
      const scope = ((ctx.get && ctx.get('lanSettings')) || ctx.settingsScope).bind({ namespace: NS })
      const [snap, setSnap] = React.useState(null)
      const [draft, setDraft] = React.useState(null)
      const [saved, setSaved] = React.useState(false)
      const [err, setErr] = React.useState('')

      // Выбор клавиши: не поле для ввода имени, а «нажмите ту, которую хотите».
      // Имена вроде KeyR человек знать не обязан.
      //
      // Хуки объявлены здесь, выше всех возвратов: если объявить их ниже, при
      // неготовых настройках карточка вернётся раньше, хуков окажется меньше,
      // и React снимет весь раздел с ошибкой.
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
          try { ((ctx.get && ctx.get('lanSettings')) || ctx.settingsScope).describe().load() } catch (e) { /* сервис ещё не поднялся */ }
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

        // Поля пишутся по одному, и раньше первая же неудача обрывала цикл:
        // остальные поля не записывались, композер не получал сигнала
        // перечитать клавишу, а на кнопку это было похоже на «ничего не
        // происходит». Теперь пишутся все, а неудачи собираются и называются
        // поимённо — иначе непонятно, какое поле виновато.
        const failed = []
        for (const k of Object.keys(draft)) {
          try {
            await scope.set(k, draft[k])
          } catch (e) {
            failed.push(k + ': ' + String(e && e.message ? e.message : e))
          }
        }

        voice.settings = {
          vadSilenceMs: Number(draft.dictation && draft.dictation.vadSilenceMs) || 700,
          autoSendMs: Number(draft.message && draft.message.autoSendMs) || 4000,
        }
        // Композер держит обработчик клавиши: пусть перечитает настройку,
        // иначе новая клавиша заработает только после перезагрузки страницы.
        try { window.dispatchEvent(new CustomEvent('dsh-voice:settings-saved')) } catch (noEvents) { /* некому */ }

        if (failed.length) { setErr(t('saveFailed') + ' ' + failed.join('; ')); return }
        setSaved(true); setTimeout(() => setSaved(false), 2000)
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
          textField('whisperModel', t('whisperModel'), t('whisperBinHint')),
          React.createElement('label', { className: 'dvs-field' }, t('whisperAutostart'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.autoStart), disabled: !writable,
              onChange: (e) => setTop('autoStart', e.target.checked),
            })),
        ),
        React.createElement('div', { className: 'dvs-row' },
          React.createElement('button', { type: 'button', className: 'dvs-save', disabled: !writable, onClick: save }, t('save')),
          saved ? React.createElement('span', { className: 'dvs-ok' }, t('saved')) : null,
          err ? React.createElement('span', { className: 'dvs-bad' }, err) : null,
        ),
      )
    }

    // Карточка во вкладке «Настройки плагинов» (#18): ядро даёт только рамку
    // списка, поэтому заголовок, пояснение и сворачивание — наши.
    // Тело монтируется при первом раскрытии: снапшот настроек тогда и придёт.
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
      // Слот объявлен пакетом настроек ядра; вкладка перебирает пространства
      // настроек, поэтому ключ регистрации обязан равняться NS, не id пакета:
      // не равен — карточка не появится вовсе, молча.
      const tryPluginItem = () => {
        try {
          ctx.slots.inject('settings.plugin.item', () => ctx.slots.register(
            {
              name: 'settings.plugin.item',
              key: NS,
              // locale в записи слота — то, из-за чего компонент получает props.t.
              locale: NS,
              inject: () => ({ ctx: ctx }),
            },
            PluginCard,
          ))
          return true
        } catch (e) { return false }
      }
      if (tryPluginItem()) return
      // Запасной путь: в этой сборке слота нет — остаёмся боковым
      // разделом, чтобы настройки не пропали.
      ctx.slots.inject('settings.section', () => ctx.slots.register(
        {
          name: 'settings.section',
          id: '@goodandready/dsh-voice',
          order: 30,
          locale: NS,
          label: () => t('title'),
          inject: () => ({ ctx: ctx }),
        },
        VoiceSection,
      ))
    }

    exports.inject = ['timer', 'slots', 'settingsScope', 'locale']
    exports.apply = function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en, ru }), 'dsh-voice: словари')
      moduleT = ctx.locale.bind(NS)
      registerComposer(ctx)
      registerSettings(ctx)
    }
    return module.exports
  },
})
