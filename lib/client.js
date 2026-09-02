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
      'whisperBin': 'Local whisper: binary',
      'whisperBinHint': 'used when autostart is on',
      'whisperModel': 'Local whisper: model',
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
      'sensevoiceAutostart': 'Autostart the SenseVoice server',
      'realtimeStreaming': 'Realtime audio streaming',
      'realtimeStreamingHint': 'Low-latency streaming via WebSocket (OpenAI Realtime API / sherpa-onnx)',
      'realtimeProvider': 'Realtime provider',
      'realtimeModel': 'Realtime model',
      'realtimeActive': 'Streaming live…',
      'realtimeConnect': 'Start streaming',
      'realtimeDisconnect': 'Stop streaming',
      'visualizerStyle': 'Audio visualizer style',
      'visualizerStyleHint': 'Waveform animation inside the recording pill',
      'visLiquidWave': 'Liquid Wave',
      'visDynamicOrb': 'Dynamic Orb',
      'visBars': 'Classic Bars',
      'visOff': 'Off',
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
      'speaking': 'Вы говорите…',
      'silence': 'Пауза…',
      'normalizeTranscript': 'Нормализация расшифровок',
      'undo': 'Отменить вставку',
      'undone': 'Вставка отменена',
      'nothingToUndo': 'Отменять нечего',
      'beep': 'Звук старта/стопа',
      'localOnly': 'Только локальный whisper',
      'localOnlyHint': 'Обе цепочки — только локальный сервер whisper.cpp: полностью офлайн.',
      'sendDelay': 'Задержка вставки диктовки (мс)',
      'sendDelayHint': 'Пауза перед вставкой фразы с окном отмены. 0 — выкл',
      'mic': 'Микрофон',
      'micDefault': 'Системной по умолчанию',
      'vocabulary': 'Свой словарь (одно слово в строке)',
      'polish': 'Полировка текста моделью',
      'polishHint': 'Пунктуация и слова-паразиты через модель харнесса перед вставкой',
      'stream': 'Непрерывная диктовка',
      'streamHint': 'Резать фразы по таймеру во время речи, а не по длинной паузе',
      'streamChunkMs': 'Кусок потока (мс)',
      'vadAdapt': 'Адаптивная тишина',
      'vadAdaptHint': 'Авто-подстройка порога под темп речи. 0 = фикс. поведение',
      'wakeWord': 'Слово-активатор',
      'wakeWordHint': 'Распознавание в браузере начинает запись, если речь начинается с этой фразы. Пусто = выкл',
      'bargeIn': 'Перебивание',
      'polishSend': 'Полировка всего текста перед отправкой',
      'polishSendHint': 'Прогнать весь текст через модель перед отправкой агенту',
      'sessionCommands': 'Голосовые команды сессии',
      'sessionCommandsHint': '«отправь», «отмени», «стоп», «продолжи» — действия сессии, а не текст',
      'polishBaseUrl': 'Локальный ендпоинт полировки',
      'polishBaseUrlHint': 'OpenAI-совместимый /chat/completions базовый URL, напр. локальный Ollama. Пусто = модель харнесса',
      'polishModel': 'Модель офлайн-полировки',
      'polishKeyEnv': 'Ключ офлайн-полировки',
      'voiceCommandsLabel': 'Голосовые команды («с новой строки», «абзац»)',
      'normalizeTranscriptHint': 'transcribe_audio: числа словами — в цифры, аккуратная пунктуация',
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
      'noiseSuppression': 'Аппаратное шумоподавление',
      'noiseSuppressionHint': 'Включить шумоподавление, эхоподавление и АРУ микрофона в браузере',
      'contextGlossary': 'Контекстный словарь терминов',
      'contextGlossaryHint': 'Авто-извлечение кода и терминов из композера для повышения точности STT',
      'providerDashboard': 'Задержка и здоровье провайдеров',
      'avgLatency': 'Ср. задержка',
      'successRate': 'Успешность',
      'fast': 'Быстро',
      'normal': 'Норма',
      'slow': 'Медленно',
      'error': 'Сбой',
      'idle': 'Нет вызовов',
      'play': 'Слушать',
      'pause': 'Пауза',
      'listenBack': 'Прослушать запись',
      'lastRecording': 'Последняя запись',
      'sensevoiceHint': 'SenseVoice-ONNX / Sherpa-ONNX · сверхбыстрый локальный STT (~50мс)',
      'sensevoiceEndpoint': 'SenseVoice: endpoint',
      'sensevoiceEndpointHint': 'POST endpoint сервера sherpa-onnx или совместимого',
      'sensevoiceBin': 'SenseVoice: бинарь',
      'sensevoiceBinHint': 'используется при автозапуске',
      'sensevoiceModel': 'SenseVoice: путь к модели',
      'sensevoiceAutostart': 'Автозапуск сервера SenseVoice',
      'realtimeStreaming': 'Потоковое аудио в реальном времени',
      'realtimeStreamingHint': 'Низколатентный стриминг через WebSocket (OpenAI Realtime API / sherpa-onnx)',
      'realtimeProvider': 'Провайдер реалтайма',
      'realtimeModel': 'Модель реалтайма',
      'realtimeActive': 'Стриминг идёт…',
      'realtimeConnect': 'Начать стриминг',
      'realtimeDisconnect': 'Остановить стриминг',
      'visualizerStyle': 'Стиль визуализатора звука',
      'visualizerStyleHint': 'Анимация волны внутри полоски записи',
      'visLiquidWave': 'Жидкая волна (Liquid Wave)',
      'visDynamicOrb': 'Динамическая сфера (Dynamic Orb)',
      'visBars': 'Классические столбики',
      'visOff': 'Выключен',
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
      lastNote: null,     // {blob, url, mime, text} — последняя запись
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
      try { parsed = await res.json() } catch (e) { /* не json */ }
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

    // Голосовые команды редактирования (#37): «с новой строки» -> \n и т.п.
    // Применяются до нормализации, только когда включены в настройках.
    const VOICE_COMMANDS = [
      [/(^|[\s,.!?])с новой строки([\s,.!?]|$)/gi, '$1\n$2'],
      [/(^|[\s,.!?])новая строка([\s,.!?]|$)/gi, '$1\n$2'],
      [/(^|[\s,.!?])абзац([\s,.!?]|$)/gi, '$1\n\n$2'],
      [/(^|\s)тире(\s|$)/gi, '$1—$2'],
    ]

    function applyVoiceCommands(text) {
      let s = text
      for (const [re, to] of VOICE_COMMANDS) s = s.replace(re, to)
      return s.replace(/[ \t]+/g, ' ').trim()
    }

    // История вставок для undo (#29-9). Хранится только в браузере.
    const insertHistory = []

    async function undoLastInsert() {
      const last = insertHistory.pop()
      if (!last) return t('nothingToUndo')
      const actions = voice.inputActions
      if (!actions || typeof actions.setDraft !== 'function') return t('composerUnavailable')
      const draft = voice.input && typeof voice.input.draft === 'string' ? voice.input.draft : ''
      if (draft === last.after) actions.setDraft(last.before)
      else {
        // Текст уже менялся руками — вырезаем последнюю вставку как подстроку.
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
      if (voice.settings.beep) playBeep(phase === 'start' ? 880 : 660)
    }

    // Короткий пик через WebAudio: слышно без взгляда на экран (#29-6).
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
        osc.onended = () => { try { ac.close() } catch (e) { /* уже закрыт */ } }
      } catch (noAudio) { /* без звука — не критично */ }
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
        rec.streamMs = 0
        if (!rec.closing) {
          try { rec.recorder.start() } catch (e) { /* поток закрылся */ }
        }
        rec.cutting = false
        if (blob.size < 1200) return       // слишком короткий кусок — это не речь
        try {
          const out = await sendAudio(blob, rec.mime, 'dictation')
          const text = out && out.text ? out.text : ''
          const delay = Number(voice.settings.sendDelayMs) || 0
          if (text && delay > 0 && !voice.holding) {
            // Отложенная вставка с окном отмены (#29-5): текст уже вставлен,
            // окно позволяет его отменить.
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

    // Распознавание браузером вместо записи файла. Возвращает false, если
    // браузер этого не умеет, — тогда идём обычным путём.
    function startBrowserLeg(mode, language) {
      if (!browserRecognitionAvailable()) return false
      const finals = []
      voice.caption = ''
      voice.browser = startBrowserRecognition({
        lang: language,
        continuous: true,
        onInterim: (text) => {
          voice.caption = text; voice.notify()
          // Wake-word (#45): если interim начинается с ключевой фразы —
          // обрываем прослушивание browser и уходим в обычную запись.
          const ww = String(voice.settings.wakeWord || '').trim().toLowerCase()
          if (ww && mode === 'dictation' && !voice.rec) {
            const t = String(text || '').trim().toLowerCase()
            if (t.startsWith(ww)) {
              voice.browser = null
              voice.caption = ''
              openMic(mode)
                .then((rec) => { voice.rec = rec; voice.notify() })
                .catch((err) => voice.set({ phase: 'error', error: String(err && err.message ? err.message : err), rec: null }))
            }
          }
        },
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
        if (voice.lastNote && voice.lastNote.url) {
          try { URL.revokeObjectURL(voice.lastNote.url) } catch (e) { /* игнор */ }
        }
        let noteUrl = ''
        try { noteUrl = URL.createObjectURL(blob) } catch (e) { /* игнор */ }
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
      // Полировка всего draft перед отправкой (#46). Ошибка не блокирует.
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
          } catch (e) { /* полировка best-effort */ }
        }
        run().finally(() => setTimeout(() => { try { actions.submit() } catch (e) { /* занят */ } }, 0))
        return
      }
      setTimeout(() => { try { actions.submit() } catch (e) { /* композер занят */ } }, 0)
    }

    // Голосовые команды сессии (#48): чистые «отправь/отмени/стоп/продолжи».
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
          // Сбрасываем ожидание/запись; текст draft намеренно не трогаем.
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
          // Удержание: пишет, пока держишь; увёл курсор далеко вверх — отмена.
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
    // 1. Liquid Wave: органическая текучая многослойная волна
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
        grad.addColorStop(0.5, '#38bdf8')
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

    // 2. Dynamic Orb: интерактивная пульсирующая сфера по центру
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
      g.strokeStyle = '#38bdf8'
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
      radial.addColorStop(0, '#ffffff')
      radial.addColorStop(0.4, '#38bdf8')
      radial.addColorStop(1, color)
      g.beginPath()
      g.arc(cx, cy, rCore, 0, Math.PI * 2)
      g.fillStyle = radial
      g.globalAlpha = 0.95
      g.fill()

      g.globalAlpha = 1
    }

    // 3. Classic Bars: классические вертикальные столбики
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
          const speaking = level > 0.06
          if (voice.speaking !== speaking) { voice.speaking = speaking; voice.notify() }
          const adapt = Number(voice.settings.vadAdapt) || 0
          let effectiveVad = Number(voice.settings.vadSilenceMs) || 700
          if (adapt > 0 && rec.hadSpeech) {
            // Адаптивный порог (#41): считаем плотность речи за последние
            // ~1s (20 сэмплов). Плотная речь -> порог ниже (точнее режем),
            // паузная -> порог растёт к базе (не режем на вдохе).
            const win = voice.levels.slice(-20)
            const density = win.length ? win.filter((v) => v > 0.06).length / win.length : 0
            const k = adapt * (density - 0.5) * 2
            effectiveVad = Math.max(150, Math.round(Number(voice.settings.vadSilenceMs) * (1 - k)))
          }
          // Непрерывный режим (#40): режем по таймеру непрерывной речи,
          // не дожидаясь длинной паузы.
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

      // Анимация осциллограммы / визуализатора.
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

      // Окно отмены режима message.
      React.useEffect(() => {
        if (v.phase !== 'pending') return
        const tick = 100
        const dispose = ctx.interval(() => {
          const p = voice.pending
          if (!p) return
          if (p.undoOnly) {
            // Режим «только отмена вставки» (#29-5): по истечении окна просто
            // прячем панель; текст либо остался, либо уже откатили руками.
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
          // Окно отмены отложенной вставки диктовки (#29-5).
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
              // Новые настройки композеру нужны без открытия карточки.
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
      'browser', 'deepgram', 'groq', 'hf', 'local-whisper', 'sensevoice',
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
      sensevoice: t('sensevoiceHint'),
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

      const [devices, setDevices] = React.useState([])
      React.useEffect(() => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return
        navigator.mediaDevices.enumerateDevices()
          .then((list) => setDevices(list.filter((d) => d.kind === 'audioinput')))
          .catch(() => {})
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
          textField('whisperModel', t('whisperModel'), t('whisperBinHint')),
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
          textField('sensevoiceModel', t('sensevoiceModel'), t('sensevoiceBinHint')),
          React.createElement('label', { className: 'dvs-field' }, t('sensevoiceAutostart'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.sensevoiceAutostart), disabled: !writable,
              onChange: (e) => setTop('sensevoiceAutostart', e.target.checked),
            })),
        ),
        React.createElement('div', { className: 'dvs-block' },
          React.createElement('div', { className: 'dvs-h' }, t('realtimeStreaming')),
          React.createElement('div', { className: 'dvs-sub' }, t('realtimeStreamingHint')),
          React.createElement('label', { className: 'dvs-field' }, t('realtimeStreaming'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.realtimeStreaming), disabled: !writable,
              onChange: (e) => setTop('realtimeStreaming', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field' }, t('realtimeProvider'),
            React.createElement('select', {
              value: String((draft && draft.realtimeProvider) || 'openai'), disabled: !writable,
              onChange: (e) => setTop('realtimeProvider', e.target.value),
            },
              React.createElement('option', { value: 'openai' }, 'OpenAI Realtime API'),
              React.createElement('option', { value: 'sherpa-onnx' }, 'Sherpa-ONNX (local)'),
            )),
          textField('realtimeModel', t('realtimeModel'), ''),
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
      // Язык может принести не только плагин: словарные пакеты объявляют
      // русский для чужих пространств. Ядро на повторное объявление той же
      // пары «пространство + язык» бросает исключение, и незащищённый вызов
      // уносил с собой весь плагин — в интерфейсе это выглядело как «Failed to
      // load plugins» с перечнем ни в чём не повинных соседей.
      //
      // Поэтому каждый язык объявляется отдельно и по-хорошему: заняли до нас —
      // уступаем, свой английский при этом всё равно встаёт на место.
      const addLocale = (locale, dictionary) => {
        try {
          return ctx.locale.register(NS, locale, dictionary)
        } catch (alreadyTaken) {
          return () => {}
        }
      }
      ctx.effect(() => {
        const undo = [addLocale('en', en), addLocale('ru', ru)]
        return () => { for (const off of undo) off() }
      }, 'dsh-voice: словари')
      moduleT = ctx.locale.bind(NS)
      registerComposer(ctx)
      registerSettings(ctx)
    }
    return module.exports
  },
})
