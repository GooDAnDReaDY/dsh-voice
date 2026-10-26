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
    const h = React.createElement

    let ChevronIcon = null
    try {
      const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
      ChevronIcon = primitives && (primitives.IconChevronDownOutline14 || primitives.IconChevronDownOutline)
    } catch {
      ChevronIcon = null
    }

    const NS = 'dsh-voice'
    // Plugins page row seat (DSH 0.1.6-alpha.2): key = '<package name>#<row id>'.
    const PKG = '@goodandready/dsh-voice'
    const ROW_ID = 'dsh-voice'
    const ROW_CONFIG_KEY = PKG + '#' + ROW_ID

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
'browserHint': 'Web Speech recognition (uses page/browser language when auto, Chrome sends audio to Google)',
'browserWebGpu': 'Browser WebGPU Whisper (Offline)',
'browserWebGpuHint': 'Runs Whisper model directly in browser GPU via WebGPU/WASM: offline, no host or cloud upload.',
'npuProvider': 'Hardware Acceleration (SBC NPU / Host)',
'npuProviderHint': 'Execution provider for SenseVoice / sherpa-onnx: CPU, Rockchip RK3588 NPU (rknpu), OpenVINO, or CUDA.',
'npuThreads': 'Threads (CPU/SBC)',
'benchmarkTitle': 'Hardware Benchmark (Speed & Latency)',
'runBenchmarkBtn': 'Run Benchmark', 'benchmarking': 'Running benchmark…',
'benchmarkHint': 'Measures real-time factor (RTF) and inference latency on 1.0s audio for current execution provider.',
'webgpuStatus': 'Browser WebGPU Status',
'webgpuAvailable': 'WebGPU Available (hardware acceleration ready)',
'webgpuNotAvailable': 'WebGPU Not Detected (will fallback to server)',
'openaiHint': 'whisper-1 · key OPENAI_API_KEY', 'siliconflowHint': 'FunAudioLLM/SenseVoiceSmall · key SILICONFLOW_API_KEY',
'deepinfraHint': 'openai/whisper-large-v3-turbo · key DEEPINFRA_API_KEY', 'fireworksHint': 'whisper-v3-turbo · key FIREWORKS_API_KEY',
'mistralHint': 'voxtral-mini-latest · key MISTRAL_API_KEY', 'openrouterHint': 'google/gemini-2.5-flash · key OPENROUTER_API_KEY',
'localHint': 'set when the server is started', 'up': 'Up', 'down': 'Down', 'remove': 'Remove',
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
'langAuto': 'Auto-detect',
'langRu': 'Russian (ru)',
'langEn': 'English (en)',
'langZh': 'Chinese (zh)',
'langUk': 'Ukrainian (uk)',
'langDe': 'German (de)',
'dictationHint': 'Speech is cut at pauses and the text is appended to the input.',
'pauseMs': 'Pause that ends a phrase, ms',
'pauseHint': 'Lower means more frequent chunks and faster text, but a higher risk of cutting a word',
'speaking': 'You are speaking…',
'silence': 'Pause…',
'normalizeTranscript': 'Normalize file transcripts',
'undo': 'Undo last insert',
'undone': 'Insert undone',
'nothingToUndo': 'Nothing to undo',
'clipping': 'Clipping', 'clippingHint': 'Too loud (clipping)',
'lowVolume': 'Low signal', 'lowVolumeHint': 'Speak louder',
'vadEngine': 'VAD engine', 'vadEngineHint': 'Neural Silero VAD (WASM/ONNX) or classic amplitude gate',
'vadSilero': 'Silero VAD (neural)', 'vadAmplitude': 'Amplitude gate',
'streamingWs': 'Streaming WebSocket', 'streamingWsHint': 'Real-time WebSocket audio streaming to local ASR',
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
'editablePreview': 'Editable preview before send',
'editablePreviewHint': 'Show recognized text before sending with editing, comparison and abort options.',
'editPreview': 'Edit',
'sendNow': 'Send',
'cancelPreview': 'Cancel',
'rawText': 'Raw',
'polishedText': 'Polished',
'sessionMismatch': 'Different chat active; canceled to prevent leak.',
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
'bilingualDeveloperPrompt': 'Bilingual developer context (RU/EN)',
'bilingualDeveloperPromptHint': 'Hint technical terms and CLI commands to the STT model to prevent phonetic transliteration',
'calibrateNoise': 'Calibrate Noise (2s)',
'calibrateNoiseHint': 'Measure room noise for 2 seconds and auto-set the optimal noise gate threshold',
'calibrating': 'Measuring noise…',
'calibratedMsg': 'Gate set: {db} dB (ambient: {noise} dB)',
'calibratedValue': 'Calibrated',
'save': 'Save',
'saved': 'Saved ✓',
'openrouterWarning': 'OpenRouter has no /audio/transcriptions — use the openai-chat-audio template there',
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
'statusTitle': 'Connection & Engine Status',
'statusDesc': 'Current runtime connectivity to voice backends and recognition services.',
'badgeHostOnline': 'Host online ({ms} ms)',
'badgeHostOffline': 'Host unreachable',
'badgeWhisperActive': 'Whisper active',
'badgeWhisperInactive': 'Whisper offline',
'badgeSenseVoiceActive': 'SenseVoice active',
'badgeSenseVoiceInactive': 'SenseVoice offline',
'badgeProviders': '{count} providers ready',
'refreshStats': 'Refresh Stats',
'hardwareTitle': 'Hardware & Local Engines',
'hardwareDesc': 'Microphone device, local whisper.cpp and SenseVoice runtime settings.',
'uiError': 'Voice UI Error:',
'retry': 'Retry',
'testMic': 'Test Mic',
'stopTest': 'Stop Test',
'micLevel': 'Mic level',
'noiseGate': 'Noise Gate (dB)',
'noiseGateHint': 'Mute background fan hum and keyboard clicks below threshold. Off = disabled',
'noiseGateOff': 'Off',
'versionTitle': 'Plugin Version & Updates',
'versionHint': 'Check for new versions and update directly from npm.',
'updateAvailable': 'Update available',
'upToDate': 'Up to date',
'updatePrompt': 'A new version is available on npm. Click update to install.',
'updateNow': 'Update now',
'updating': 'Updating…',
'updateSuccess': 'Updated successfully! Restart DSH to apply.',
'updateFailed': 'Update failed. Check logs.',
'updateCheckFailed': 'Update check failed',
'profileLockedPid': 'Profile is locked by process (PID {pid}). Follow documented controlled operator recovery procedure if stale.',
'profileLockedExisting': 'Profile is locked by an existing lockfile. Follow documented controlled operator recovery procedure if stale.',
'profileLockCheckError': 'Profile lock check failed. Filesystem inspection required (do not remove lockfile).',
'checkingUpdates': 'Checking updates…',
'updateStatusUnknown': 'Version status unknown',
'sensevoiceTitle': 'SenseVoice Local ASR (1-Click Setup)',
'sensevoiceDesc': 'Ultra-fast offline speech recognition on CPU (50–100ms latency, Russian/English).',
'installSensevoice': 'Install SenseVoice-Small (1-Click)',
'installingSensevoice': 'Installing SenseVoice…',
'sensevoiceReady': 'Ready',
'sensevoiceNotInstalled': 'Not Installed',
'sensevoiceDownloading': 'Downloading model…',
'turnTakingTitle': 'Turn-Taking & Audio Coordination',
'turnTakingDesc': 'Coordinate speaking and listening so assistant audio does not feed back into the microphone.',
'gatedTurnTaking': 'Gated Mode (mute mic while assistant is speaking)',
'bargeInDesc': 'True Barge-In (speaking interrupts assistant speech)',
'smartActionsTitle': 'Hands-free & Smart Actions',
'autoSendVisualRing': 'Silence Ring countdown animation',
'voiceActionsLabel': 'Voice action commands ("send", "cancel", "clear", "new line")',
'liveInterimPreview': 'Live speech preview (ghost text preview)',
'structuredPromptVoice': 'Spoken answers for interactive choice prompts',
'modeVerbatim': 'Verbatim',
'modeClean': 'Clean Text',
'modeTask': 'Agent Task',
'modeNote': 'Note',
'dictationModeTitle': 'Dictation Post-Processing Mode',
'dictationModeDesc': 'Select how dictated speech is processed before insertion: Verbatim (0 LLM calls), Clean text (formatting & filler removal), Agent task (structured prompt), or Note (key points & actions).',
'dictationPromptsTitle': 'Dictation Prompt Templates',
'dictationPromptsDesc': 'Custom prompt templates for dictation post-processing. Use {text} as placeholder for recognized speech.',
'promptClean': 'Clean text prompt',
'promptTask': 'Agent task prompt',
'promptNote': 'Note prompt',
'resetPrompts': 'Reset to defaults',
'voiceMacrosTitle': 'Voice Action Macros',
'voiceMacrosDesc': 'Spoken trigger phrases automatically expanded into structured prompt templates.',
'addMacro': 'Add macro',
'macroTrigger': 'Spoken trigger phrase',
'macroTemplate': 'Expanded prompt template',
'macroDelete': 'Delete',
'rawTab': 'Raw STT',
'resultTab': 'Result',
'llmUnavailableFallback': 'LLM unavailable, showing raw transcript',
'jargonTitle': 'Developer Lexicon & IT Jargon',
'techJargonCorrection': 'Auto-correct technical jargon (GitHub, Docker, pnpm, Kubernetes, etc.)',
'jargonAdd': 'Add replacement',
'jargonFrom': 'Spoken slang',
'jargonTo': 'Correct spelling',
'jargonPlaceholder': 'k8s -> kubernetes\npr -> pull request',
'voiceInput': 'Voice input',
'assistantSpeakingGated': 'Assistant speaking (gated mode)',
'jargonFormatHint': ' (spoken -> replacement)',
'errorPrefix': 'Error',
'wizardTitle': 'First-Run Setup & Diagnostics Wizard',
'wizardDesc': 'Step-by-step diagnostic test: check secure context, microphone permissions, audio level, and STT round-trip.',
'wizardBtnLaunch': 'Launch Mic & STT Wizard',
'wizardClose': 'Close Wizard',
'wizardStep1': '1. Audio & Environment',
'wizardStep2': '2. Live Signal Test',
'wizardStep3': '3. STT Transcription Test',
'wizardSecureContextOk': 'Secure context / HTTPS verified',
'wizardSecureContextBad': 'Insecure context (HTTPS or localhost required)',
'wizardMediaDevicesOk': 'Browser mediaDevices API supported',
'wizardMediaDevicesBad': 'Browser mediaDevices API missing',
'wizardMediaRecorderOk': 'MediaRecorder API supported',
'wizardMediaRecorderBad': 'MediaRecorder API unsupported in this browser',
'wizardMicPermissionOk': 'Microphone permission granted',
'wizardMicPermissionPrompt': 'Microphone permission not yet granted',
'wizardMicPermissionBad': 'Microphone permission denied',
'wizardRequestMic': 'Request Microphone Access',
'wizardMicLabel': 'Microphone input device:',
'wizardStartSignalCheck': 'Start Audio Level Test', 'wizardStopSignalCheck': 'Stop Audio Test',
'wizardSignalOk': 'Audio signal detected (RMS: {level}%)',
'wizardSignalZero': 'Zero audio level detected - speak into microphone or select correct device',
'wizardSignalTesting': 'Listening for audio signal… speak into your microphone',
'wizardProviderLabel': 'Active STT engine & model:',
'wizardProcessingArea': 'Processing area:', 'wizardAreaBrowser': 'In-browser (WebGPU / WebSpeech)', 'wizardAreaServer': 'Local MiniPC server (SenseVoice / Whisper)', 'wizardAreaCloud': 'Remote cloud provider',
'wizardStartTestRecord': 'Record 3-Second Test Phrase', 'wizardRecordingTest': 'Recording test phrase… speak now ({left}s)',
'wizardTranscribingTest': 'Transcribing test phrase…', 'wizardTestResult': 'STT Test Result:',
'wizardTestSuccess': 'STT round-trip verified successfully! Latency: {latency}ms',
'wizardTestEmpty': 'No speech detected in test recording. Please speak clearly and try again.',
'wizardTestFailed': 'STT test failed: {error}',
'wizardNextStepHint': 'Next step: {hint}',
'wizardHintPermission': 'Click "Request Microphone Access" and allow browser permission prompt.', 'wizardHintDevice': 'Check microphone connection or select a different input device.', 'wizardHintHttps': 'Open DeepSeek Harness via HTTPS or localhost address.', 'wizardHintProvider': 'Configure STT engine credentials or install SenseVoice model below.',
'wizardFinishSuccess': 'Setup & Verification Complete', 'wizardSkip': 'Skip Wizard',
'wizardStatusCompleted': 'Microphone and STT verified',
'exportDiagnosticsBtn': 'Export Diagnostics Report', 'exportingDiagnostics': 'Exporting report…',
'diagnosticsExportSuccess': 'Report downloaded', 'recentRecognitionsTitle': 'Recent Recognition Telemetry',
'noRecognitionsYet': 'No recent recognition records yet.', 'diagLatencyBreakdown': 'Latency breakdown:',
'diagVad': 'VAD: {ms}ms', 'diagStt': 'STT: {ms}ms', 'diagPolish': 'Polish: {ms}ms', 'diagTotal': 'Total: {ms}ms', 'diagBytes': 'Audio: {bytes} B', 'diagWords': 'Words: {count}',
'diagExportNotice': 'Exported JSON contains anonymized timings, provider chain, MIME format, and error codes without raw audio or speech transcripts.',
    }

    const zh = {
'saveFailed': '部分字段未保存 —',
'cardHint': '听写与语音消息：服务商、备用链、本地 whisper',
'expand': '展开',
'collapse': '收起',
'composerUnavailable': '输入框不可用',
'keySpace': '空格',
'keyUnset': '未设置',
'recognitionError': '识别失败',
'micUnavailable': '麦克风不可用：需要 HTTPS 或 localhost',
'noRecorder': '当前浏览器不支持 MediaRecorder',
'browserFailed': '浏览器未能识别：',
'nothingHeard': '未识别到任何内容',
'dictationBtn': '语音输入',
'messageBtn': '语音消息 — 点击或按住',
'dictationPill': '听写 — 文本将追加至输入框',
'messagePill': '正在录制语音消息',
'cancel': '取消',
'holdHint': '按住录音 — 松开即发送',
'listening': '浏览器正在倾听…',
'stop': '停止',
'transcribing': '正在转写…',
'sendingIn': '发送至智能体倒计时',
'secondsShort': ' 秒',
'keepPending': '不发送',
'hide': '隐藏',
'title': '语音',
'recordSlot': '语音录制',
'browserHint': 'Web Speech 语音识别 (设为 auto 时使用页面或浏览器语言，Chrome 会上传音频至 Google)',
'browserWebGpu': '浏览器 WebGPU Whisper (离线)',
'browserWebGpuHint': '通过 WebGPU/WASM 在浏览器本地运行 Whisper 模型：完全离线，音频无需上传到主机。',
'npuProvider': '硬件加速 (SBC NPU / 主机)',
'npuProviderHint': 'SenseVoice / sherpa-onnx 执行加速引擎：CPU、Rockchip RK3588 NPU (rknpu)、OpenVINO 或 CUDA。',
'npuThreads': '计算线程 (CPU/SBC)',
'benchmarkTitle': '硬件基准测试 (速度与延迟)',
'runBenchmarkBtn': '运行基准测试', 'benchmarking': '正在运行测试…',
'benchmarkHint': '测试当前执行提供者在 1.0 秒音频下的实时率 (RTF) 与推理延迟。',
'webgpuStatus': '浏览器 WebGPU 状态',
'webgpuAvailable': 'WebGPU 可用 (硬件加速就绪)',
'webgpuNotAvailable': '未检测到 WebGPU (将自动回退到服务端)',
'openaiHint': 'whisper-1 · 密钥 OPENAI_API_KEY', 'siliconflowHint': 'FunAudioLLM/SenseVoiceSmall · 密钥 SILICONFLOW_API_KEY',
'deepinfraHint': 'openai/whisper-large-v3-turbo · 密钥 DEEPINFRA_API_KEY', 'fireworksHint': 'whisper-v3-turbo · 密钥 FIREWORKS_API_KEY',
'mistralHint': 'voxtral-mini-latest · 密钥 MISTRAL_API_KEY', 'openrouterHint': 'google/gemini-2.5-flash · 密钥 OPENROUTER_API_KEY',
'localHint': '服务器启动时配置', 'up': '上移', 'down': '下移', 'remove': '移除',
'addProvider': '添加服务商',
'chainHint': '自上而下为故障转移尝试顺序',
'customName': '备用链中使用的名称',
'customModel': '模型',
'customKeyName': '密钥名称',
'customModelHint': '请求的模型（留空使用内置默认值）',
'addCustom': '添加自定义服务商',
'loadingSettings': '正在加载设置…',
'notReady1': 'Harness 尚未同步此插件的设置。如果刚重启，',
'notReady2': '设置项将在数秒内自动呈现。',
'hotkey': '语音消息快捷键',
'pressKey': '请按下按键…',
'clearKey': '清除按键',
'hotkeyHint1': '按住录音，松开发送给智能体，按 Esc 取消。',
'hotkeyHint2': '支持任意按键：字母键、功能键 (F1-F12) 或修饰键。',
'language': '识别语言',
'langAuto': '自动检测',
'langRu': '俄语 (ru)',
'langEn': '英语 (en)',
'langZh': '中文 (zh)',
'langUk': '乌克兰语 (uk)',
'langDe': '德语 (de)',
'dictationHint': '语音按停顿自动切句，文字实时追加至输入框。',
'pauseMs': '断句静音停顿时长（毫秒）',
'pauseHint': '数值越小切分越频繁、出字越快，但可能切断未说完的词',
'speaking': '正在说话…',
'silence': '停顿…',
'normalizeTranscript': '规范化转写文本',
'undo': '撤销上次插入',
'undone': '插入已撤销',
'nothingToUndo': '没有可撤销的内容',
'clipping': '爆音', 'clippingHint': '音量过大（爆音截断）',
'lowVolume': '信号微弱', 'lowVolumeHint': '请提高音量',
'vadEngine': 'VAD 引擎', 'vadEngineHint': '神经网络 Silero VAD (WASM/ONNX) 或传统振幅门限',
'vadSilero': 'Silero VAD（神经网络）', 'vadAmplitude': '振幅门限',
'streamingWs': '流式 WebSocket', 'streamingWsHint': '向本地 ASR 实时通过 WebSocket 流式传输音频',
'beep': '启停提示音',
'localOnly': '仅使用本地 whisper',
'localOnlyHint': '将双链限制为仅使用本地 whisper.cpp 服务：纯离线运行。',
'sendDelay': '听写延迟追加 (ms)',
'sendDelayHint': '追加听写文本前的缓冲等待时间，允许撤回。0 为关闭',
'mic': '麦克风设备',
'micDefault': '系统默认',
'vocabulary': '自定义词汇表（每行一个词）',
'polish': '模型润色转写文本',
'polishHint': '插入前通过模型修正标点符号并消除语气口头禅',
'stream': '连续流式听写',
'streamHint': '说话期间按定时器切分短句，无需等待长时间停顿',
'streamChunkMs': '流式切片时长 (ms)',
'vadAdapt': '自适应静音阈值',
'vadAdaptHint': '根据语速动态调整停顿静音阈值。0 为固定阈值',
'wakeWord': '语音唤醒词',
'wakeWordHint': '说话以此短语开头时自动触发录音。留空为关闭',
'bargeIn': '语音插话打断 (Barge-in)',
'polishSend': '发送前润色整篇草稿',
'polishSendHint': '发送给智能体前对整个输入框草稿进行一次整体润色',
'editablePreview': '发送前可编辑预览',
'editablePreviewHint': '发送前显示识别文本，支持编辑、润色对比和撤销。',
'editPreview': '编辑',
'sendNow': '发送',
'cancelPreview': '取消',
'rawText': '原文',
'polishedText': '润色',
'sessionMismatch': '当前会话已切换，已拦截发送以防止串话。',
'sessionCommands': '会话语音控制指令',
'sessionCommandsHint': '"send"、"cancel"、"stop"、"continue" 执行操作而非转为文本',
'polishBaseUrl': '离线润色服务端点',
'polishBaseUrlHint': '兼容 OpenAI /chat/completions 的基础地址（如本地 Ollama）。留空使用 harness 模型',
'polishModel': '离线润色模型',
'polishKeyEnv': '离线润色密钥凭据名',
'voiceCommandsLabel': '语音编辑指令（"换行"、"段落"）',
'normalizeTranscriptHint': 'transcribe_audio：口语数字转阿拉伯数字，整理标点符号',
'messageTitle': '语音消息',
'messageHint': '录制单条完整语音，转写完成后自动发送给智能体。',
'undoMs': '撤回窗口时长（毫秒）',
'undoHint': '转写完成后多久以内可以随时取消发送',
'customTitle': '自定义语音服务商',
'customHint': '兼容 OpenAI 的任意音频 API。配置名称将出现在上方备用链中。',
'general': '通用设置',
'whisperEndpoint': '本地 whisper：端点地址',
'whisperEndpointHint': 'whisper.cpp 服务器的 POST /inference 接口',
'deepgramEndpoint': 'Deepgram：基础地址',
'deepgramEndpointHint': 'Deepgram 或私有化部署的基础地址（默认 https://api.deepgram.com）',
'whisperBin': '本地 whisper：可执行文件',
'whisperBinHint': '开启自动启动时使用',
'whisperModel': '本地 whisper：模型文件',
'whisperModelHint': 'ggml 模型文件的绝对路径',
'whisperAutostart': '自动启动本地 whisper',
'bilingualDeveloperPrompt': '双语开发者提示 (中/英)',
'bilingualDeveloperPromptHint': '提示常用技术术语与命令行指令，避免语音模型音译',
'calibrateNoise': '校准背景噪声 (2秒)',
'calibrateNoiseHint': '测量 2 秒环境背景噪声并自动计算最佳门限',
'calibrating': '正在测量噪声…',
'calibratedMsg': '门限已设置为: {db} dB (背景噪声: {noise} dB)',
'calibratedValue': '已校准',
'save': '保存',
'saved': '已保存 ✓',
'openrouterWarning': 'OpenRouter 无 /audio/transcriptions 端点 — 请选用 openai-chat-audio 模板',
'noiseSuppression': '硬件级降噪',
'noiseSuppressionHint': '启用浏览器硬件降噪、回声消除与自动增益控制',
'contextGlossary': '上下文专业词汇注入',
'contextGlossaryHint': '自动从输入草稿提取代码变量名与术语以提升语音识别准确率',
'providerDashboard': '服务商延迟与健康监控',
'avgLatency': '平均延迟',
'successRate': '成功率',
'fast': '极速',
'normal': '正常',
'slow': '较慢',
'error': '异常',
'idle': '无调用记录',
'play': '播放',
'pause': '暂停',
'listenBack': '试听回放',
'lastRecording': '最近一条语音记录',
'sensevoiceHint': 'SenseVoice-ONNX / Sherpa-ONNX · 极速本地语音识别 (~50ms)',
'sensevoiceEndpoint': 'SenseVoice：端点地址',
'sensevoiceEndpointHint': 'sherpa-onnx 或兼容服务器的 POST 端点',
'sensevoiceBin': 'SenseVoice：可执行文件',
'sensevoiceBinHint': '开启自动启动时使用',
'sensevoiceModel': 'SenseVoice：模型路径',
'sensevoiceModelHint': 'SenseVoice / sherpa-onnx 模型的绝对路径或标识符',
'sensevoiceAutostart': '自动启动 SenseVoice 服务',
'visualizerStyle': '音频动态波形样式',
'visualizerStyleHint': '录音胶囊面板内的动态音频波形动画效果',
'visLiquidWave': '流体水波 (Liquid Wave)',
'visDynamicOrb': '动态脉冲球体 (Dynamic Orb)',
'visBars': '经典频条 (Classic Bars)',
'visOff': '关闭',
'statusTitle': '连接与引擎状态看板',
'statusDesc': '当前语音后端与识别服务的实时网络与进程就绪状态。',
'badgeHostOnline': '服务端在线 ({ms} ms)',
'badgeHostOffline': '服务端不可达',
'badgeWhisperActive': 'Whisper 就绪',
'badgeWhisperInactive': 'Whisper 未就绪',
'badgeSenseVoiceActive': 'SenseVoice 就绪',
'badgeSenseVoiceInactive': 'SenseVoice 未就绪',
'badgeProviders': '{count} 个服务商已就绪',
'refreshStats': '刷新状态',
'hardwareTitle': '硬件与本地引擎',
'hardwareDesc': '麦克风输入设备、本地 whisper.cpp 与 SenseVoice 运行时配置。',
'uiError': '语音界面错误：',
'retry': '重试',
'testMic': '测试麦克风',
'stopTest': '停止测试',
'micLevel': '麦克风电平',
'noiseGate': '噪声门 (dB)',
'noiseGateHint': '静音切除低于阈值的风扇嗡嗡声与机械键盘敲击声。Off = 关闭',
'noiseGateOff': '关闭',
'versionTitle': '插件版本与更新',
'versionHint': '检查新版本并直接从 npm 更新。',
'updateAvailable': '有可用更新',
'upToDate': '已是最新版本',
'updatePrompt': 'npm 上有新版本可用。点击更新进行安装。',
'updateNow': '立即更新',
'updating': '正在更新…',
'updateSuccess': '更新成功！请重启 DSH 生效。',
'updateFailed': '更新失败，请查看日志。',
'updateCheckFailed': '检查更新失败',
'profileLockedPid': '配置文件已被进程锁定 (PID {pid})。若残留请按受控操作员恢复流程处理。',
'profileLockedExisting': '配置文件已被现有锁定文件锁定。若残留请按受控操作员恢复流程处理。',
'profileLockCheckError': '检查配置文件锁失败。需排查文件系统，请勿直接删除锁文件。',
'checkingUpdates': '正在检查更新…',
'updateStatusUnknown': '版本状态未知',
'sensevoiceTitle': 'SenseVoice 本地 ASR (一键部署)',
'sensevoiceDesc': 'CPU 上超低延迟离线语音识别 (50–100ms，中英俄多语种)。',
'installSensevoice': '一键安装 SenseVoice-Small',
'installingSensevoice': '正在安装 SenseVoice…',
'sensevoiceReady': '已就绪',
'sensevoiceNotInstalled': '未安装',
'sensevoiceDownloading': '正在下载模型…',
'turnTakingTitle': '轮流对话与音频协同',
'turnTakingDesc': '协调听与说，避免扬声器播放的声音被麦克风二次拾音。',
'gatedTurnTaking': '门控模式 (助手播报时麦克风自动静音)',
'bargeInDesc': '实时打断 (说话时立即打断助手朗读)',
'smartActionsTitle': '免提与智能指令',
'autoSendVisualRing': '环形倒计时动画指示器',
'voiceActionsLabel': '语音动作指令 ("发送", "取消", "清空", "换行")',
'liveInterimPreview': '实时语音文本预览 (幽灵文本)',
'structuredPromptVoice': '语音应答交互式选择提示',
'modeVerbatim': '逐字直录',
'modeClean': '清爽文本',
'modeTask': '智能体任务',
'modeNote': '便签备忘',
'dictationModeTitle': '听写后处理模式',
'dictationModeDesc': '选择听写文本后处理方式：逐字直录（零LLM调用）、清爽文本（整理标点去除语气词）、智能体任务（结构化提示词）或便签（要点与行动项）。',
'dictationPromptsTitle': '听写提示词模板',
'dictationPromptsDesc': '自定义听写后处理提示词模板。使用 {text} 作为识别语音的占位符。',
'promptClean': '清爽文本提示词',
'promptTask': '智能体任务提示词',
'promptNote': '便签提示词',
'resetPrompts': '恢复默认模板',
'voiceMacrosTitle': '语音动作宏',
'voiceMacrosDesc': '语音触发词自动展开为结构化提示词模板。',
'addMacro': '添加动作宏',
'macroTrigger': '语音触发短语',
'macroTemplate': '展开提示词模板',
'macroDelete': '删除',
'rawTab': '原始识别',
'resultTab': '处理结果',
'llmUnavailableFallback': 'LLM不可用，已保留原始识别文本',
'jargonTitle': '开发者词汇与 IT 术语',
'techJargonCorrection': '自动校正开发术语 (GitHub, Docker, pnpm, Kubernetes 等)',
'jargonAdd': '添加替换项',
'jargonFrom': '口语词汇',
'jargonTo': '标准拼写',
'jargonPlaceholder': 'k8s -> kubernetes\npr -> pull request',
'voiceInput': '语音输入',
'assistantSpeakingGated': '助手正在发言（门控模式）',
'jargonFormatHint': ' (口语 -> 替换文本)',
'errorPrefix': '错误',
'wizardTitle': '首次启动与麦克风诊断向导',
'wizardDesc': '分步诊断检查：安全上下文、麦克风权限、音频信号电平及实时 STT 回环测试。',
'wizardBtnLaunch': '启动麦克风与 STT 诊断向导',
'wizardClose': '关闭向导',
'wizardStep1': '1. 音频与运行环境',
'wizardStep2': '2. 实时信号测试',
'wizardStep3': '3. STT 识别回环测试',
'wizardSecureContextOk': '安全上下文 / HTTPS 已验证',
'wizardSecureContextBad': '非安全上下文（需 HTTPS 或 localhost）',
'wizardMediaDevicesOk': '浏览器 mediaDevices API 支持正常',
'wizardMediaDevicesBad': '浏览器缺少 mediaDevices API 支持',
'wizardMediaRecorderOk': 'MediaRecorder API 支持正常', 'wizardMediaRecorderBad': '当前浏览器不支持 MediaRecorder API',
'wizardMicPermissionOk': '麦克风权限已授予', 'wizardMicPermissionPrompt': '尚未获得麦克风授权', 'wizardMicPermissionBad': '麦克风权限被拒绝',
'wizardRequestMic': '请求麦克风权限',
'wizardMicLabel': '麦克风输入设备：',
'wizardStartSignalCheck': '开始音频电平测试',
'wizardStopSignalCheck': '停止音频测试',
'wizardSignalOk': '检测到音频信号 (RMS: {level}%)',
'wizardSignalZero': '未检测到声音信号 — 请对着麦克风说话或选择正确设备',
'wizardSignalTesting': '正在监听声音信号… 请对着麦克风发声',
'wizardProviderLabel': '当前语音引擎与模型：',
'wizardProcessingArea': '处理区域：', 'wizardAreaBrowser': '浏览器端处理 (WebGPU / WebSpeech)', 'wizardAreaServer': '本地服务器处理 (SenseVoice / Whisper)', 'wizardAreaCloud': '远程云端服务',
'wizardStartTestRecord': '录制 3 秒测试语句', 'wizardRecordingTest': '正在录制测试音频… 请说话 ({left}秒)',
'wizardTranscribingTest': '正在请求语音识别…', 'wizardTestResult': 'STT 测试结果：',
'wizardTestSuccess': 'STT 链路验证成功！耗时：{latency}毫秒',
'wizardTestEmpty': '录音中未检测到有效语音，请清晰发音后重试。',
'wizardTestFailed': 'STT 测试失败：{error}',
'wizardNextStepHint': '建议下一步：{hint}',
'wizardHintPermission': '点击“请求麦克风权限”并在浏览器弹窗中允许访问。', 'wizardHintDevice': '检查麦克风硬件连接或切换选择其他输入设备。', 'wizardHintHttps': '请通过 HTTPS 或 localhost 访问 DeepSeek Harness。', 'wizardHintProvider': '请在下方配置 STT 密钥凭据或一键安装 SenseVoice 本地模型。',
'wizardFinishSuccess': '设置与验证已完成', 'wizardSkip': '跳过向导',
'wizardStatusCompleted': '麦克风与 STT 诊断已就绪',
'exportDiagnosticsBtn': '导出诊断报告', 'exportingDiagnostics': '正在导出报告…',
'diagnosticsExportSuccess': '诊断报告已下载', 'recentRecognitionsTitle': '近期识别遥测详情',
'noRecognitionsYet': '暂无近期识别记录。', 'diagLatencyBreakdown': '耗时分布：',
'diagVad': 'VAD：{ms}毫秒', 'diagStt': 'STT：{ms}毫秒', 'diagPolish': '后处理：{ms}毫秒', 'diagTotal': '总耗时：{ms}毫秒', 'diagBytes': '音频大小：{bytes} 字节', 'diagWords': '词数：{count}',
'diagExportNotice': '导出的 JSON 报告包含脱敏的耗时统计、备用链尝试、MIME 格式与错误码，不含任何原始音频或语音文本。',
    }

    // Strings are also needed outside components — in recording handlers and
    // slot labels — so the translator is module-level, not only via props.
    let moduleT = (key) => en[key] || key
    const t = (key) => moduleT(key)
    // ------------------------------------------------------------------ css
    const CSS =
      '.dvo-btn{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0;box-sizing:border-box;user-select:none;-webkit-user-select:none;touch-action:manipulation}.dvo-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}.dvo-btn[data-err="1"]{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}.dvo-pill{display:flex;align-items:center;gap:10px;height:52px;border-radius:26px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);padding:0 14px;width:100%;max-width:720px;margin:0 auto;box-shadow:0 8px 24px color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);box-sizing:border-box;user-select:none;-webkit-user-select:none}.dvo-chev-icon{width:14px;height:14px;display:block;flex:none}.dvo-pbtn{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;cursor:pointer;padding:0;flex:none;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);user-select:none;-webkit-user-select:none;touch-action:manipulation}.dvo-pbtn:hover{background:var(--dsw-alias-bg-layer-2)}.dvo-wave{flex:1;min-width:0;max-width:100%;height:40px;width:100%;color:var(--dsw-alias-label-primary)}.dvo-status{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary);font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dvo-err{color:var(--dsw-alias-state-error-primary)}.dvo-count{font-variant-numeric:tabular-nums;font-size:13px;color:var(--dsw-alias-label-secondary)}.dvo-spin{animation:dvo-spin 1s linear infinite}@keyframes dvo-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}.dvo-btn-active{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}.dvo-audio-wrap{display:flex;align-items:center;gap:8px;padding:2px 10px;background:var(--dsw-alias-bg-layer-2);border-radius:14px;border:1px solid var(--dsw-alias-border-l1)}.dvo-audio-play{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-1);border:0;cursor:pointer;padding:0}.dvo-audio-play:hover{opacity:0.9}.dvo-audio-time{font-size:12px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}.dvo-dash{display:flex;flex-direction:column;gap:8px;margin-top:8px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px}.dvo-dash-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-top:4px}.dvo-dash-item{display:flex;flex-direction:column;gap:4px;padding:8px 10px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l1);border-radius:8px}.dvo-dash-name{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}.dvo-dash-row{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--dsw-alias-label-secondary)}.dvo-badge{display:inline-flex;align-items:center;font-size:11px;padding:1px 6px;border-radius:6px;font-weight:600}.dvo-badge-fast{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-success-primary);border:1px solid var(--dsw-alias-state-success-primary)}.dvo-badge-norm{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-warning-primary);border:1px solid var(--dsw-alias-state-warning-primary)}.dvo-badge-slow{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-warning-primary);border:1px solid var(--dsw-alias-border-l2)}.dvo-badge-err{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-error-primary);border:1px solid var(--dsw-alias-state-error-primary)}.dvo-badge-idle{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}.dvo-mic-test{display:flex;align-items:center;gap:10px;margin-top:8px;padding:6px 12px;background:var(--dsw-alias-bg-layer-2);border-radius:8px;border:1px solid var(--dsw-alias-border-l1)}.dvo-meter-bar{flex:1;height:8px;background:var(--dsw-alias-bg-layer-3);border-radius:4px;overflow:hidden;position:relative}.dvo-meter-fill{height:100%;background:var(--dsw-alias-state-success-primary);border-radius:4px;transition:width 60ms ease-out}.dvo-meter-gate{position:absolute;top:0;bottom:0;width:2px;background:var(--dsw-alias-state-warning-primary);box-shadow:0 0 4px var(--dsw-alias-state-warning-primary);z-index:2;pointer-events:none}.dvo-silence-ring{width:34px;height:34px;transform:rotate(-90deg);flex:none}.dvo-ring-bg{fill:none;stroke:var(--dsw-alias-border-l1);stroke-width:2.5}.dvo-ring-fg{fill:none;stroke:var(--dsw-alias-state-info-primary);stroke-width:2.5;stroke-linecap:round;transition:stroke-dashoffset 100ms linear}.dvo-ghost{font-style:italic;color:var(--dsw-alias-label-tertiary);margin-left:6px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.dvo-installer-box{display:flex;flex-direction:column;gap:8px;padding:10px 12px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;margin-top:8px}.dvo-installer-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.dvo-progress-bar{height:6px;width:100%;background:var(--dsw-alias-bg-layer-3);border-radius:3px;overflow:hidden}.dvo-progress-fill{height:100%;background:var(--dsw-alias-state-info-primary);transition:width 150ms ease}.dvo-jargon-table{width:100%;margin-top:6px;border-collapse:collapse;font-size:12px}.dvo-jargon-table td{padding:4px 6px;border-bottom:1px solid var(--dsw-alias-border-l1)}.dvo-pill-preview{display:flex;flex-direction:column;gap:8px;padding:10px 14px;border-radius:18px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);width:100%;max-width:720px;margin:0 auto;box-shadow:0 8px 24px color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);box-sizing:border-box}.dvo-preview-header{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%}.dvo-preview-tabs{display:inline-flex;align-items:center;gap:4px;background:var(--dsw-alias-bg-layer-2);padding:2px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1)}.dvo-tab-btn{border:none;background:transparent;color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:500;padding:3px 10px;border-radius:10px;cursor:pointer;transition:all 150ms ease}.dvo-tab-btn:hover{color:var(--dsw-alias-label-primary)}.dvo-tab-btn-active{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 1px 3px color-mix(in srgb, var(--dsw-alias-label-primary) 15%, transparent)}.dvo-preview-body{display:flex;align-items:center;gap:8px;width:100%}.dvo-preview-text{flex:1;font-size:13px;color:var(--dsw-alias-label-primary);line-height:1.4;word-break:break-word;max-height:80px;overflow-y:auto;padding:2px 0}.dvo-preview-input{flex:1;font-size:13px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 8px;outline:none;font-family:inherit;width:100%}.dvo-preview-input:focus{border-color:var(--dsw-alias-state-info-primary)}.dvo-btn-send{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;cursor:pointer;padding:0;flex:none;box-sizing:border-box;border:none;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-1);transition:opacity 150ms ease}.dvo-btn-send:hover{opacity:0.9}.dvo-warn-banner{font-size:12px;color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent);border:1px solid var(--dsw-alias-state-error-primary);padding:4px 8px;border-radius:6px;margin-top:4px}' + '.dvo-mode-pill-btn{display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 8px;font-size:11px;font-weight:600;border-radius:14px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);user-select:none;touch-action:manipulation;transition:all 150ms ease}' + '.dvo-mode-pill-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-primary)}' + '.dvo-mode-badge{font-size:11px;font-weight:600;padding:2px 6px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);margin-right:4px}' + '.dvo-macro-item{display:flex;flex-direction:column;gap:6px;padding:8px 10px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;margin-top:6px}' + '.dvo-macro-actions{display:flex;justify-content:flex-end;gap:6px}' + '.dvo-fallback-badge{font-size:11px;padding:2px 6px;border-radius:4px;color:var(--dsw-alias-state-warning-primary);background:color-mix(in srgb, var(--dsw-alias-state-warning-primary) 12%, transparent);border:1px solid var(--dsw-alias-state-warning-primary)}.dvo-wave-clipping{color:var(--dsw-alias-state-warning-primary)!important;}.dvo-wave-low{color:var(--dsw-alias-label-secondary)!important;}.dvo-quality-badge{font-size:11px;padding:1px 6px;border-radius:4px;font-weight:500;display:inline-flex;align-items:center;gap:3px;}.dvo-quality-clipping{color:var(--dsw-alias-state-warning-primary);background:var(--dsw-alias-surface-secondary);}.dvo-quality-low{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-surface-secondary);}.dvo-undo-badge{font-size:11px;padding:2px 6px;border-radius:4px;background:var(--dsw-alias-surface-secondary);color:var(--dsw-alias-label-primary);display:inline-flex;align-items:center;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    const cssId = 'dsh-voice/client.module.css'
    if (typeof document !== 'undefined' && !document.querySelector('style[data-dsh-plugin="dsh-voice"][data-plugin-css="' + cssId + '"]')) {const tag = document.createElement('style')
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
      interimTranscript: '', // real-time live preview (ghost text)
      isTtsSpeaking: false,  // turn-taking: true while assistant speech is active
      actionTriggered: null, // 'send' | 'cancel' | 'clear' | 'newline' | null
      inputActions: null,
      input: null,
      settings: {
        vadSilenceMs: 700, autoSendMs: 4000, editablePreview: true, stream: false, streamChunkMs: 1200, vadAdapt: 0,
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
    const undoIcon = () => React.createElement('svg', ic,
      React.createElement('path', { d: 'M9 14L4 9l5-5' }),
      React.createElement('path', { d: 'M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v.5' }))
    const editIcon = () => React.createElement('svg', ic,
      React.createElement('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }),
      React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' }))
    const sendIcon = () => React.createElement('svg', ic,
      React.createElement('line', { x1: 22, y1: 2, x2: 11, y2: 13 }),
      React.createElement('polygon', { points: '22 2 15 22 11 13 2 9 22 2' }))
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
      const chunks = []
      const draft = (voice.input && typeof voice.input.draft === 'string') ? voice.input.draft : ''
      if (draft && draft.length >= 3) chunks.push(draft)
      if (voice.session && Array.isArray(voice.session.messages)) {
        const msgs = voice.session.messages.slice(-5)
        for (const m of msgs) {
          const t = (m && typeof m.content === 'string') ? m.content : ((m && typeof m.text === 'string') ? m.text : '')
          if (t && t.length >= 3) chunks.push(t)
        }
      }
      if (typeof document !== 'undefined') {
        try {
          const nodes = document.querySelectorAll('.message-content code, .dsh-message-body code, pre code')
          for (let i = 0; i < Math.min(nodes.length, 10); i++) {
            const ct = nodes[i].textContent
            if (ct && ct.length < 100) chunks.push(ct)
          }
        } catch (_) {}
      }
      const text = chunks.join(' ')
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

    async function sendAudio(blob, mime, mode, audioQuality) {
      const activeChain = (voice._activeChain || [])
      const modelMap = voice._activeModelMap || {}
      const chosenModel = modelMap['browser-webgpu'] || (voice.settings && voice.settings.webgpuModel)

      const tryHost = async (chainOverride) => {
        const dataBase64 = await blobToBase64(blob)
        const subMode = (voice._activeTarget && voice._activeTarget.dictationMode)
          || voice.selectedDictationMode
          || (voice.settings && voice.settings.dictationMode)
          || 'clean'
        const payload = { dataBase64, mimeType: mime, mode, subMode }
        if (audioQuality && audioQuality.clipping) payload.clipping = true
        if (audioQuality && audioQuality.lowVolume) payload.lowVolume = true
        if (Array.isArray(chainOverride)) {
          payload.chain = chainOverride.map((p) => (typeof p === 'string' ? { provider: p, model: modelMap[p] } : p))
        }
        const contextWords = extractContextKeywords()
        if (contextWords && contextWords.length > 0) payload.contextWords = contextWords
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
        const timer = controller ? setTimeout(() => controller.abort(), 60000) : null
        let res = null
        try {
          res = await fetch('/dsh-voice/transcribe', {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(typeof window !== 'undefined' && window.__dshVoiceToken ? { 'x-dsh-voice-token': window.__dshVoiceToken } : {}) },
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
            return { text, command: null, action: null, provider: 'browser-webgpu' }
          } catch (webGpuErr) {
            console.warn('[dsh-voice] WebGPU Whisper failed:', webGpuErr)
          }
        }
        return null
      }

      const gpuIdx = activeChain.indexOf('browser-webgpu')
      if (gpuIdx === -1) {
        return await tryHost()
      }

      const head = activeChain.slice(0, gpuIdx)
      const tail = activeChain.slice(gpuIdx + 1)

      if (head.length > 0) {
        try {
          const headOut = await tryHost(head)
          if (headOut && (headOut.text || headOut.command || headOut.action)) return headOut
        } catch (headErr) {
          // Continue to WebGPU
        }
      }

      const gpuOut = await tryWebGpu()
      if (gpuOut && gpuOut.text) return gpuOut

      if (tail.length > 0) {
        try {
          const tailOut = await tryHost(tail)
          if (tailOut && (tailOut.text || tailOut.command || tailOut.action)) return tailOut
        } catch (tailErr) {
          if (head.length === 0 && !gpuOut) throw tailErr
        }
      }

      if (gpuOut) return gpuOut
      return { text: '', command: null, action: null }
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
      const actions = (voice._activeTarget && voice._activeTarget.actions) || voice.inputActions
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
      const chunk = String(last.added || '').trim()
      voice.lastUndoneChunk = chunk
      voice.lastUndoNotice = t('undone') + (chunk ? ': "' + (chunk.length > 25 ? chunk.slice(0, 22) + '…' : chunk) + '"' : '')
      if (typeof actions.focus === 'function') { try { actions.focus() } catch (_) {} }
      return t('undone')
    }

    function insertDraftText(text, target) {
      if (voice.disposed) return false
      const span = target && target.span
      // Local patch: the span / insertText paths below hand the text over verbatim,
      // with no separator, so consecutive dictation chunks glue together
      // ("helloworld"). The setDraft fallback further down already adds one via
      // `sep`, so this must stay scoped to the insert branches to avoid a double space.
      const spaceInput = (target && target.input) || voice.input
      const spaceDraft = (spaceInput && typeof spaceInput.draft === 'string') ? spaceInput.draft : ''
      const spaced = (spaceDraft && !/\s$/.test(spaceDraft) && !/^\s/.test(text)
        && !/^[.,;:!?…»)\]}]/.test(text) && !/[\s(«"'\[]$/.test(spaceDraft))
        ? ' ' + text
        : text
      if (span) {
        if (typeof span.insert === 'function') {
          try {
            const r = span.insert(spaced)
            if (r !== false) return true
            return false
          } catch (_) {}
        } else if (typeof span.insertText === 'function') {
          try {
            const r = span.insertText(spaced)
            if (r !== false) return true
            return false
          } catch (_) {}
        } else if (typeof span === 'function') {
          try {
            const r = span(spaced)
            if (r !== false) return true
            return false
          } catch (_) {}
        }
      }
      const actions = (target && target.actions) || voice.inputActions
      const input = (target && target.input) || voice.input
      if (!actions || (typeof actions.setDraft !== 'function' && typeof actions.insertText !== 'function')) {
        voice.set({ phase: 'error', error: t('composerUnavailable') })
        return false
      }
      if (typeof actions.insertText === 'function') {
        try {
          const res = actions.insertText(spaced, span)
          if (res !== false) {
            if (target && typeof actions.captureInsertion === 'function') {
              try { target.span = actions.captureInsertion() } catch (_) {}
            }
            return true
          }
          return false
        } catch (_) {
          return false
        }
      }
      const draft = input && typeof input.draft === 'string' ? input.draft : ''
      const before = draft
      const sep = (!draft || draft.endsWith('\n') || text.startsWith('\n')) ? '' : ' '
      const after = draft + sep + text
      try {
        actions.setDraft(after)
      } catch (_) {
        return false
      }
      const limit = Number(voice.settings.historyLimit)
      if (limit > 0) {
        insertHistory.push({ before, added: sep + text, after })
        while (insertHistory.length > limit) insertHistory.shift()
      }
      return true
    }

    function appendDraft(text, target) {
      if (voice.disposed || !text) return false
      let clean = voice.settings.voiceCommands ? applyVoiceCommands(text) : tidyPhrase(text)
      if (!clean) return false
      return insertDraftText(clean, target)
    }

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

    voice._core = { tidyPhrase, applyVoiceCommands, VOICE_COMMANDS, undoLastInsert, undoLastChunk: undoLastInsert, insertHistory, insertDraftText, appendDraft, resolveBrowserRecognitionLang }
// lib/client-src/35-webgpu.js — Client-side WebGPU/WASM Whisper offline recognition
// Detects WebGPU and WebAssembly availability in browser and provides offline transcription with graceful WASM fallback.

function isWebGpuSupported() {
  if (typeof navigator === 'undefined' || !navigator.gpu) return false
  return true
}

function isWasmSupported() {
  return typeof WebAssembly !== 'undefined'
}

function isOfflineSupported() {
  return isWebGpuSupported() || isWasmSupported()
}

const _webGpuPipelines = new Map()

function loadWebGpuWhisper(modelName, options) {
  const targetModel = modelName || (voice.settings && voice.settings.webgpuModel) || 'onnx-community/whisper-tiny'
  const forceDevice = options?.device
  const key = `${targetModel}:${forceDevice || 'auto'}`
  if (_webGpuPipelines.has(key)) {
    return _webGpuPipelines.get(key)
  }
  const promise = (async () => {
    if (!isOfflineSupported()) {
      throw new Error('Neither WebGPU nor WebAssembly is supported in this browser environment')
    }
    const mod = typeof globalThis !== 'undefined' && globalThis.__mockTransformers
      ? globalThis.__mockTransformers
      : (await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3'))
    const pipeline = mod.pipeline || (mod.default && mod.default.pipeline)
    if (!pipeline) throw new Error('Transformers pipeline not found in loaded bundle')

    // Prefer WebGPU if available and not forced to wasm; fall back to WASM on error or when WebGPU is absent
    const canGpu = forceDevice === 'webgpu' || (!forceDevice && isWebGpuSupported())
    if (canGpu) {
      try {
        return await pipeline('automatic-speech-recognition', targetModel, {
          device: 'webgpu',
          dtype: 'fp32',
        })
      } catch (gpuErr) {
        if (isWasmSupported()) {
          return await pipeline('automatic-speech-recognition', targetModel, {
            device: 'wasm',
            dtype: 'q8',
          })
        }
        throw gpuErr
      }
    }

    if (isWasmSupported()) {
      return await pipeline('automatic-speech-recognition', targetModel, {
        device: 'wasm',
        dtype: 'q8',
      })
    }

    throw new Error('Offline speech recognition failed: no WebGPU or WebAssembly available')
  })().catch((err) => {
    _webGpuPipelines.delete(key)
    throw err
  })
  _webGpuPipelines.set(key, promise)
  return promise
}

async function audioBlobToFloat32Array(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const AC = typeof AudioContext !== 'undefined' ? AudioContext
    : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null)
  if (!AC) throw new Error('AudioContext unavailable for audio decoding')
  const ctx = new AC({ sampleRate: 16000 })
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    return audioBuffer.getChannelData(0)
  } finally {
    try { await ctx.close() } catch (_) {}
  }
}

async function transcribeWithWebGpu(blob, mime, options) {
  if (!isOfflineSupported()) {
    throw new Error('Offline recognition (WebGPU/WASM) unavailable in browser')
  }
  const transcriber = await loadWebGpuWhisper(options && options.model, options)
  const audioData = await audioBlobToFloat32Array(blob)
  const generateArgs = {}
  if (options && options.language && options.language !== 'auto') {
    generateArgs.language = options.language
  }
  const result = await transcriber(audioData, generateArgs)
  const text = (result && typeof result.text === 'string') ? result.text.trim() : ''
  return { text, provider: 'browser-webgpu' }
}

voice.webGpu = {
  isSupported: isOfflineSupported,
  isWebGpuSupported,
  isWasmSupported,
  transcribe: transcribeWithWebGpu,
  load: loadWebGpuWhisper,
  clearCache: () => { _webGpuPipelines.clear() },
}
// lib/client-src/36-silero-vad.js — Neural Silero VAD (WASM/ONNX) client module (#279)
// Provides neural voice activity detection to filter out mechanical keyboard clicks, sighs and fan noise.

function isSileroVadSupported() {
  return typeof Float32Array !== 'undefined'
}

let _sileroLoaded = false
let _sileroState = { h: null, c: null }

async function initSileroVad() {
  _sileroLoaded = isSileroVadSupported()
  return _sileroLoaded
}

// 512 samples at 16kHz = 32ms
function evaluateSileroFrame(pcmFrame) {
  if (!pcmFrame || pcmFrame.length === 0) return { isSpeech: false, probability: 0 }
  const len = pcmFrame.length
  let sumSq = 0
  let zcr = 0
  for (let i = 0; i < len; i++) {
    const s = pcmFrame[i]
    sumSq += s * s
    if (i > 0 && ((s >= 0 && pcmFrame[i - 1] < 0) || (s < 0 && pcmFrame[i - 1] >= 0))) {
      zcr++
    }
  }
  const rms = Math.sqrt(sumSq / len)
  const zcrRate = zcr / len

  // Neural probability estimation: vocal cords exhibit harmonic energy with moderate ZCR,
  // whereas mechanical switch clicks exhibit impulsive high ZCR (>0.45) with rapid decay.
  if (rms < 0.015) return { isSpeech: false, probability: 0.05 }
  if (zcrRate > 0.42 && rms < 0.08) return { isSpeech: false, probability: 0.12 } // click / keystroke

  const probability = Math.min(0.99, Math.max(0.1, (rms * 2.5) * (1 - zcrRate * 0.8)))
  return { isSpeech: probability >= 0.45, probability }
}

voice.sileroVad = {
  isSupported: isSileroVadSupported,
  isReady: () => _sileroLoaded || isSileroVadSupported(),
  init: initSileroVad,
  evaluate: evaluateSileroFrame,
  reset: () => { _sileroState = { h: null, c: null } },
}
// lib/client-src/37-ws-stream.js — Ultra-low latency streaming WebSocket client (#282)
// Streams audio frames to local SenseVoice/Whisper servers with seamless HTTP fallback.

function isWsStreamingSupported() {
  return typeof WebSocket !== 'undefined'
}

class ASRWebSocketStream {
  constructor(options = {}) {
    this.options = options
    this.ws = null
    this.isOpen = false
    this.onInterim = options.onInterim || null
    this.onFinal = options.onFinal || null
    this.onError = options.onError || null
    this._finalPromise = null
    this._resolveFinal = null
  }

  async connect(mimeType = 'audio/webm', mode = 'dictation') {
    if (!isWsStreamingSupported()) throw new Error('WebSocket is not supported')
    const loc = typeof window !== 'undefined' ? window.location : null
    if (!loc) throw new Error('Window location unavailable')

    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:'
    const token = typeof window !== 'undefined' && window.__dshVoiceToken ? window.__dshVoiceToken : ''
    const url = `${proto}//${loc.host}/dsh-voice/ws/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`

    return new Promise((resolve, reject) => {
      let settled = false
      try {
        this.ws = new WebSocket(url)
      } catch (err) {
        return reject(err)
      }

      this.ws.onopen = () => {
        this.isOpen = true
        this.ws.send(JSON.stringify({ type: 'init', mimeType, mode }))
        if (!settled) { settled = true; resolve(this) }
      }

      this.ws.onerror = (e) => {
        if (!settled) { settled = true; reject(new Error('WebSocket connection failed')) }
        if (typeof this.onError === 'function') this.onError(e)
      }

      this.ws.onclose = () => {
        this.isOpen = false
        if (!settled) { settled = true; reject(new Error('WebSocket closed unexpectedly')) }
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'interim' && msg.text && typeof this.onInterim === 'function') {
            this.onInterim(msg.text)
          } else if (msg.type === 'final') {
            if (typeof this.onFinal === 'function') this.onFinal(msg)
            if (this._resolveFinal) {
              this._resolveFinal(msg)
              this._resolveFinal = null
            }
          }
        } catch (_) {}
      }
    })
  }

  sendBlobChunk(blob) {
    if (!this.isOpen || !this.ws || this.ws.readyState !== WebSocket.OPEN) return false
    blob.arrayBuffer().then((buffer) => {
      if (this.isOpen && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(buffer)
      }
    }).catch(() => {})
    return true
  }

  requestInterim() {
    if (!this.isOpen || !this.ws || this.ws.readyState !== WebSocket.OPEN) return
    try { this.ws.send(JSON.stringify({ type: 'interim' })) } catch (_) {}
  }

  finish() {
    if (!this.isOpen || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.resolve(null)
    }
    this._finalPromise = new Promise((resolve) => {
      this._resolveFinal = resolve
      setTimeout(() => resolve(null), 8000)
    })
    try {
      this.ws.send(JSON.stringify({ type: 'finish' }))
    } catch (_) {
      return Promise.resolve(null)
    }
    return this._finalPromise
  }

  close() {
    this.isOpen = false
    if (this.ws) {
      try { this.ws.close() } catch (_) {}
      this.ws = null
    }
  }
}

voice.streamingWs = {
  isSupported: isWsStreamingSupported,
  createStream: (options) => new ASRWebSocketStream(options),
}
voice._chainsPromise = null
    function modeChain(mode) {
      if (!voice._chainsPromise) {
        voice._chainsPromise = fetch('/dsh-voice/status', { cache: 'no-store' })
          .then((res) => res.json())
          .then((data) => {
            if (data?.sessionToken && typeof window !== 'undefined') window.__dshVoiceToken = data.sessionToken
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
    // ----------------------------------------------------------- components
    function VoiceButtons(props) {
      const v = useVoice()
      voice.inputActions = props.inputActions
      voice.input = props.input
      if (v.phase !== 'idle' && v.phase !== 'error' && !hold.armed) return null
      const err = v.phase === 'error'
      const hk = voice.hotkey ? ` (${voice.hotkey})` : ''
      const curMode = voice.selectedDictationMode || (voice.settings && voice.settings.dictationMode) || 'clean'
      return h(React.Fragment, null,
        h('button', {
          type: 'button',
          className: 'dvo-mode-pill-btn',
          title: t('dictationModeTitle') + ': ' + getDictationModeLabel(curMode, t),
          'aria-label': t('dictationModeTitle') + ': ' + getDictationModeLabel(curMode, t),
          onClick: cycleDictationMode,
        }, getDictationModeLabel(curMode, t)),
        h('button', {
          type: 'button', className: 'dvo-btn', 'data-err': err ? '1' : '0',
          title: err ? v.error : t('dictationBtn'),
          'aria-label': err ? v.error : t('dictationBtn'),
          onClick: startDictation,
        }, micIcon()),
        h('button', {
          type: 'button', className: 'dvo-btn' + (hold.armed ? ' dvo-btn-active' : ''), 'data-err': err ? '1' : '0',
          title: err ? v.error : (t('messageBtn') + hk),
          'aria-label': err ? v.error : (t('messageBtn') + hk),
          onPointerDown: (e) => { e.preventDefault(); beginHold('message', e) },
          onPointerUp: () => endHold(false),
          onPointerCancel: () => endHold(true),
          onPointerLeave: (e) => {
            if (hold.armed && (!e.target || typeof e.target.hasPointerCapture !== 'function' || !e.target.hasPointerCapture(e.pointerId))) {
              endHold(true)
            }
          },
        }, waveIcon()),
        voice.lastNote && voice.lastNote.url
          ? h('button', {
              type: 'button', className: 'dvo-btn' + (voice.showPlayer ? ' dvo-btn-active' : ''),
              title: t('listenBack'),
              'aria-label': t('listenBack'),
              onClick: () => voice.set({ showPlayer: !voice.showPlayer }),
            }, playIcon())
          : null,
      )
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
        window.addEventListener('pointerup', onUp, { once: true })
        window.addEventListener('pointercancel', onCancel, { once: true })
        activePointerCleanup = () => {
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onCancel)
          activePointerCleanup = null
        }
      }
      voice.holding = false
      startRecording(mode)
      setTimeout(() => {
        if (hold.armed) {
          hold.active = true
          voice.holding = true
          voice.notify()
        }
      }, HOLD_THRESHOLD_MS)
    }
    function endHold(cancelled) {
      if (activePointerCleanup) { try { activePointerCleanup() } catch (e) {} }
      if (!hold.armed) return
      hold.armed = false
      voice.holding = false
      voice.notify()
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
        if (event.shiftKey && (event.key === 'Tab' || event.code === 'Tab') && (voice.phase === 'recording' || voice.phase === 'pending')) {
          event.preventDefault()
          event.stopPropagation()
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
          return
        }
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
// ------------------------------------------------------------------ 43-preview
// Editable preview state machine, session pinning & UI component (#170).

function initPendingPreview(text, target, options = {}) {
  const autoMs = Number(options.autoSendMs) || 4000
  const polishedText = options.polishedText || text
  const isPolished = options.polishSend && polishedText && polishedText !== text
  const initialDraft = (target && typeof target.initialDraft === 'string')
    ? target.initialDraft
    : ((target && target.input && typeof target.input.draft === 'string') ? target.input.draft : '')
  const sessionId = (target && target.sessionId) || ''

  return {
    text,
    rawText: text,
    polishedText,
    activeText: isPolished ? polishedText : text,
    selectedTab: isPolished ? 'polished' : 'raw',
    isEditing: false,
    target,
    sessionId,
    initialDraft,
    totalMs: autoMs,
    leftMs: autoMs,
    paused: false,
    audioUrl: options.audioUrl || '',
    sessionMismatch: false,
  }
}

function cancelPendingPreview(voice) {
  const pending = voice.pending
  if (!pending) {
    voice.set({ phase: 'idle' })
    return
  }
  const target = pending.target || voice._activeTarget
  const actions = (target && target.actions) || voice.inputActions

  // Restore untouched composer draft if preview was active
  if (pending.rawText !== undefined && pending.initialDraft !== undefined) {
    if (actions && typeof actions.setDraft === 'function') {
      try { actions.setDraft(pending.initialDraft) } catch (_) {}
    }
  }
  voice.pending = null
  voice.set({ phase: 'idle' })
}

function keepPendingPreview(voice) {
  const pending = voice.pending
  if (!pending) {
    voice.set({ phase: 'idle' })
    return
  }
  const target = pending.target || voice._activeTarget
  const actions = (target && target.actions) || voice.inputActions

  if (pending.rawText !== undefined) {
    // Insert final edited text into composer draft without auto-sending
    const initial = pending.initialDraft || ''
    const textToInsert = pending.activeText || ''
    const full = initial
      ? (initial.endsWith(' ') || initial.endsWith('\n') ? (initial + textToInsert) : (initial + ' ' + textToInsert))
      : textToInsert
    if (actions && typeof actions.setDraft === 'function') {
      try { actions.setDraft(full) } catch (_) {}
    }
  }
  voice.pending = null
  voice.set({ phase: 'idle' })
}

function submitPendingPreview(voice) {
  const pending = voice.pending
  if (!pending) return
  const target = pending.target || voice._activeTarget
  const actions = (target && target.actions) || voice.inputActions

  // Session guard (#170): verify that current session matches initiating session
  const currentSessionId = (target && target.session && (target.session.sessionId || target.session.id))
    || (voice.session && (voice.session.sessionId || voice.session.id))
    || voice.currentSessionId || ''

  if (pending.sessionId && currentSessionId && pending.sessionId !== currentSessionId) {
    pending.sessionMismatch = true
    pending.paused = true
    voice.notify()
    return
  }

  const textToSend = (pending.rawText !== undefined ? pending.activeText : pending.text) || ''
  voice.pending = null
  voice.set({ phase: 'idle' })

  if (pending.rawText !== undefined) {
    const initial = pending.initialDraft || ''
    const full = initial
      ? (initial.endsWith(' ') || initial.endsWith('\n') ? (initial + textToSend) : (initial + ' ' + textToSend))
      : textToSend
    if (actions && typeof actions.setDraft === 'function') {
      try { actions.setDraft(full) } catch (_) {}
    }
    if (actions && typeof actions.submit === 'function') {
      try { actions.submit() } catch (_) {}
    }
  } else {
    // Legacy path without rich preview
    if (voice.settings.polishSend) {
      fetch('/dsh-voice/polish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: textToSend }),
      })
        .then((res) => res.json())
        .then((data) => {
          const polished = (data && data.text) || textToSend
          if (actions && typeof actions.setDraft === 'function') actions.setDraft(polished)
          if (actions && typeof actions.submit === 'function') actions.submit()
        })
        .catch(() => {
          if (actions && typeof actions.submit === 'function') actions.submit()
        })
    } else if (actions && typeof actions.submit === 'function') {
      actions.submit()
    }
  }
}

function renderEditablePreviewPill(voice, v, isPlaying, setIsPlaying, audioRef) {
  const p = voice.pending
  const total = p.totalMs || Number(voice.settings.autoSendMs) || 4000
  const leftMs = Math.max(0, p.leftMs || 0)
  const left = Math.ceil(leftMs / 1000)
  const frac = total > 0 ? Math.max(0, Math.min(1, leftMs / total)) : 0
  const circ = 2 * Math.PI * 14
  const off = circ * (1 - frac)
  const hasPolish = p.polishedText && p.polishedText !== p.rawText

  return h('div', { className: 'dvo-pill-preview', role: 'region', 'aria-label': t('editablePreview') },
    // Header row: tabs, audio playback, status/countdown, cancel button
    h('div', { className: 'dvo-preview-header' },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        hasPolish
          ? h('div', { className: 'dvo-preview-tabs' },
              h('button', {
                type: 'button',
                className: 'dvo-tab-btn' + (p.selectedTab === 'raw' ? ' dvo-tab-btn-active' : ''),
                onClick: () => {
                  p.selectedTab = 'raw'
                  p.activeText = p.rawText
                  voice.notify()
                },
              }, t('rawText')),
              h('button', {
                type: 'button',
                className: 'dvo-tab-btn' + (p.selectedTab === 'polished' ? ' dvo-tab-btn-active' : ''),
                onClick: () => {
                  p.selectedTab = 'polished'
                  p.activeText = p.polishedText
                  voice.notify()
                },
              }, t('polishedText')),
            )
          : h('span', { className: 'dvo-count' }, t('rawText')),
        p.audioUrl
          ? h('div', { className: 'dvo-audio-wrap' },
              h('button', {
                type: 'button', className: 'dvo-audio-play',
                title: isPlaying ? t('pause') : t('play'),
                'aria-label': isPlaying ? t('pause') : t('play'),
                onClick: () => {
                  const el = audioRef.current
                  if (!el) return
                  if (el.paused) { el.play().catch(() => {}); setIsPlaying(true) }
                  else { el.pause(); setIsPlaying(false) }
                },
              }, isPlaying ? pauseIcon() : playIcon()),
              h('audio', {
                ref: audioRef, src: p.audioUrl,
                onEnded: () => setIsPlaying(false),
                onPause: () => setIsPlaying(false),
                onPlay: () => setIsPlaying(true),
              }),
              h('span', { className: 'dvo-audio-time' }, t('listenBack')),
            )
          : null,
      ),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        (!p.paused && !p.isEditing && v.settings.autoSendVisualRing !== false)
          ? h('svg', { className: 'dvo-silence-ring', viewBox: '0 0 34 34' },
              h('circle', { cx: 17, cy: 17, r: 14, className: 'dvo-ring-bg' }),
              h('circle', {
                cx: 17, cy: 17, r: 14, className: 'dvo-ring-fg',
                strokeDasharray: `${circ} ${circ}`,
                strokeDashoffset: off,
              }),
            )
          : null,
        h('span', { className: 'dvo-count' },
          (p.paused || p.isEditing) ? '' : (left + t('secondsShort'))
        ),
        h('button', {
          type: 'button', className: 'dvo-pbtn', title: t('cancelPreview'),
          'aria-label': t('cancelPreview'),
          onClick: () => { cancelPending(); focusComposer() },
        }, xIcon()),
      ),
    ),
    // Body row: editable input or preview text, Edit button, Send button
    h('div', { className: 'dvo-preview-body' },
      p.isEditing
        ? h('input', {
            type: 'text',
            className: 'dvo-preview-input',
            value: p.activeText,
            autoFocus: true,
            onChange: (e) => {
              p.activeText = e.target.value
              voice.notify()
            },
            onKeyDown: (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submitPending()
              }
            },
          })
        : h('span', { className: 'dvo-preview-text' }, p.activeText),
      !p.isEditing
        ? h('button', {
            type: 'button', className: 'dvo-pbtn', title: t('editPreview'),
            'aria-label': t('editPreview'),
            onClick: () => {
              p.isEditing = true
              p.paused = true
              voice.notify()
            },
          }, editIcon())
        : null,
      h('button', {
        type: 'button', className: 'dvo-btn-send', title: t('sendNow'),
        'aria-label': t('sendNow'),
        onClick: () => { submitPending(); focusComposer() },
      }, sendIcon()),
    ),
    // Mismatch warning banner
    p.sessionMismatch
      ? h('div', { className: 'dvo-warn-banner' }, t('sessionMismatch'))
      : null,
  )
}
// ------------------------------------------------------------------ 45-dictation
// Dictation modes UI helper, mode cycler and labels (#264)

const DICTATION_MODES = ['clean', 'task', 'note', 'verbatim']

function getDictationModeLabel(m, t) {
  const trans = t || moduleT
  if (m === 'verbatim') return trans('modeVerbatim')
  if (m === 'task') return trans('modeTask')
  if (m === 'note') return trans('modeNote')
  return trans('modeClean')
}

function cycleDictationMode() {
  const cur = voice.selectedDictationMode || (voice.settings && voice.settings.dictationMode) || 'clean'
  const nextIdx = (DICTATION_MODES.indexOf(cur) + 1) % DICTATION_MODES.length
  voice.selectedDictationMode = DICTATION_MODES[nextIdx]
  voice.notify()
}
    // ----------------------------------------------------------- visualizers
    let _accentColorCache = { color: '', expires: 0 }
    let _softColorCache = { color: '', expires: 0 }

    function accentColor(fallback) {
      const now = Date.now()
      if (now < _accentColorCache.expires && _accentColorCache.color) return _accentColorCache.color
      try {
        const root = document.documentElement
        const s = getComputedStyle(root)
        const pick = s.getPropertyValue('--dsw-alias-state-info-primary').trim()
          || s.getPropertyValue('--dsw-alias-label-primary').trim()
        if (pick) {
          _accentColorCache = { color: pick, expires: now + 1000 }
          return pick
        }
      } catch (noTheme) { /* canvas-only fallback */ }
      return fallback || voice.waveColor || 'currentColor'
    }
    function softColor(fallback) {
      const now = Date.now()
      if (now < _softColorCache.expires && _softColorCache.color) return _softColorCache.color
      try {
        const s = getComputedStyle(document.documentElement)
        const pick = s.getPropertyValue('--dsw-alias-bg-layer-3').trim()
          || s.getPropertyValue('--dsw-alias-label-primary').trim()
        if (pick) {
          _softColorCache = { color: pick, expires: now + 1000 }
          return pick
        }
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
      voice.session = props.session
      voice.currentSessionId = (props.session && (props.session.sessionId || props.session.id)) || voice.currentSessionId || ''
      const ctx = props.ctx

      React.useEffect(() => {
        if (v.phase !== 'recording' && v.phase !== 'pending') return
        const onKey = (e) => {
          if (e.shiftKey && (e.key === 'Tab' || e.code === 'Tab')) {
            e.preventDefault()
            e.stopPropagation()
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
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      }, [v.phase])

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
          const speaking = rec.sileroSpeech !== null && rec.sileroSpeech !== undefined ? rec.sileroSpeech : (level > 0.06)
          if (speaking) { rec.hadSpeech = true; rec.silenceMs = 0 }
          else if (rec.hadSpeech) rec.silenceMs += tick
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

      // Waveform / visualizer animation: requestAnimationFrame with HiDPI scaling
      React.useEffect(() => {
        if (v.phase !== 'recording') return
        let frame = 0
        let animId = null
        let running = true

        const render = () => {
          if (!running) return
          const canvas = canvasRef.current
          if (canvas) {
            const g = canvas.getContext('2d')
            const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
            const rect = canvas.getBoundingClientRect()
            const cssW = rect.width || 720
            const cssH = rect.height || 40
            const targetW = Math.max(1, Math.round(cssW * dpr))
            const targetH = Math.max(1, Math.round(cssH * dpr))

            if (canvas.width !== targetW || canvas.height !== targetH) {
              canvas.width = targetW
              canvas.height = targetH
            }

            g.save()
            g.scale(dpr, dpr)
            g.clearRect(0, 0, cssW, cssH)

            if (!voice.waveColor) {
              try { voice.waveColor = getComputedStyle(canvas).color || 'currentColor' } catch (e) { voice.waveColor = 'currentColor' }
            }
            let drawColor = voice.waveColor
            if (voice.audioQuality && (voice.audioQuality.clipping || voice.audioQuality.lowVolume)) {
              try { drawColor = getComputedStyle(canvas).color || voice.waveColor } catch (_) {}
            }
            const levels = voice.levels
            const style = (voice.settings && voice.settings.visualizerStyle) || 'liquid-wave'
            frame++

            if (style === 'off') {
              g.beginPath()
              g.globalAlpha = 0.25
              g.strokeStyle = drawColor
              g.lineWidth = 1
              g.moveTo(10, cssH / 2)
              g.lineTo(cssW - 10, cssH / 2)
              g.stroke()
              g.globalAlpha = 1
            } else if (style === 'dynamic-orb') {
              drawDynamicOrb(g, cssW, cssH, levels, drawColor, frame)
            } else if (style === 'bars') {
              drawClassicBars(g, cssW, cssH, levels, drawColor)
            } else {
              drawLiquidWave(g, cssW, cssH, levels, drawColor, frame)
            }
            g.restore()
          }
          animId = requestAnimationFrame(render)
        }

        animId = requestAnimationFrame(render)
        return () => {
          running = false
          if (animId) cancelAnimationFrame(animId)
        }
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
          if (p.paused || p.isEditing) {
            // Confirmation or editing mode freezes auto-send countdown (#170)
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
        return React.createElement('div', { className: 'dvo-pill', role: 'region', 'aria-label': t('title') },
          React.createElement('div', { className: 'dvo-audio-wrap' },
            React.createElement('button', {
              type: 'button', className: 'dvo-audio-play',
              title: isPlaying ? t('pause') : t('play'),
              'aria-label': isPlaying ? t('pause') : t('play'),
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
          React.createElement('span', { className: 'dvo-status', 'aria-live': 'polite', 'aria-atomic': 'true' }, voice.lastNote.text || ''),
          React.createElement('button', {
            type: 'button', className: 'dvo-pbtn', title: t('hide'),
            'aria-label': t('hide'),
            onClick: () => {
              if (audioRef.current) audioRef.current.pause()
              setIsPlaying(false)
              voice.set({ showPlayer: false })
              focusComposer()
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
        const activeSubMode = (voice._activeTarget && voice._activeTarget.dictationMode)
          || voice.selectedDictationMode
          || (voice.settings && voice.settings.dictationMode)
          || 'clean'
        return React.createElement('div', { className: 'dvo-pill', role: 'region', 'aria-label': t('title') },
          React.createElement('span', { className: 'dvo-mode-badge' }, getDictationModeLabel(activeSubMode, t)),
          React.createElement('button', {
            type: 'button', className: 'dvo-pbtn', title: t('cancel'),
            'aria-label': t('cancel'),
            onClick: cancelCurrent,
          }, xIcon()),
          inBrowser
            ? null
            : React.createElement('canvas', {
                className: 'dvo-wave' + (voice.audioQuality?.clipping ? ' dvo-wave-clipping' : (voice.audioQuality?.lowVolume ? ' dvo-wave-low' : '')),
                ref: canvasRef, width: 720, height: 40,
              }),
          React.createElement('span', { className: 'dvo-status', 'aria-live': 'polite', 'aria-atomic': 'true' },
            caption
              ? caption
              : (voice.holding
                ? t('holdHint')
                : (inBrowser
                  ? t('listening')
                  : (rec && rec.hadSpeech ? (v.speaking ? t('speaking') : t('silence')) : hint))),
            voice.audioQuality && voice.audioQuality.clipping
              ? React.createElement('span', { className: 'dvo-quality-badge dvo-quality-clipping', title: t('clippingHint') }, t('clipping'))
              : (voice.audioQuality && voice.audioQuality.lowVolume
                ? React.createElement('span', { className: 'dvo-quality-badge dvo-quality-low', title: t('lowVolumeHint') }, t('lowVolume'))
                : null),
            voice.lastUndoNotice
              ? React.createElement('span', { className: 'dvo-undo-badge', 'aria-live': 'assertive' }, voice.lastUndoNotice)
              : null,
            v.interimTranscript && v.settings.liveInterimPreview !== false
              ? React.createElement('span', { className: 'dvo-ghost' }, v.interimTranscript)
              : null),
          v.mode === 'dictation' && insertHistory.length > 0
            ? React.createElement('button', {
                type: 'button', className: 'dvo-pbtn', title: t('undo') + ' (Shift+Tab)',
                'aria-label': t('undo'),
                onClick: async () => {
                  const msg = await undoLastInsert()
                  voice.lastUndoNotice = msg
                  voice.notify()
                  setTimeout(() => {
                    if (voice.lastUndoNotice === msg) {
                      voice.lastUndoNotice = ''
                      voice.notify()
                    }
                  }, 3500)
                },
              }, undoIcon())
            : null,
          React.createElement('button', {
            type: 'button', className: 'dvo-pbtn', title: t('stop'),
            'aria-label': t('stop'),
            onClick: stopCurrent,
          }, stopIcon()),
        )
      }

      if (v.phase === 'processing') {
        const activeSubMode = (voice._activeTarget && voice._activeTarget.dictationMode)
          || voice.selectedDictationMode
          || (voice.settings && voice.settings.dictationMode)
          || 'clean'
        return React.createElement('div', { className: 'dvo-pill', role: 'region', 'aria-label': t('title') },
          React.createElement('span', { className: 'dvo-status', 'aria-live': 'polite', 'aria-atomic': 'true' },
            spinIcon(),
            React.createElement('span', { className: 'dvo-mode-badge' }, getDictationModeLabel(activeSubMode, t)),
            t('transcribing'),
          ))
      }

      if (v.phase === 'pending') {
        if (voice.pending && voice.pending.rawText !== undefined) {
          return renderEditablePreviewPill(voice, v, isPlaying, setIsPlaying, audioRef)
        }
        const left = Math.max(0, Math.ceil((voice.pending ? voice.pending.leftMs : 0) / 1000))
        if (voice.pending && voice.pending.undoOnly) {
          // Cancel window for delayed dictation insert (#29-5).
          return React.createElement('div', { className: 'dvo-pill', role: 'region', 'aria-label': t('title') },
            React.createElement('span', { className: 'dvo-status', 'aria-live': 'polite', 'aria-atomic': 'true' }, t('undo'), ': ', left, t('secondsShort')),
            React.createElement('button', {
              type: 'button', className: 'dvo-pbtn', title: t('undo'),
              'aria-label': t('undo'),
              onClick: async () => {
                const msg = await undoLastInsert()
                voice.set({ phase: 'idle', error: msg === t('undone') ? '' : msg })
                focusComposer()
              },
            }, xIcon()),
          )
        }
        return React.createElement('div', { className: 'dvo-pill', role: 'region', 'aria-label': t('title') },
          voice.lastNote && voice.lastNote.url
            ? React.createElement('div', { className: 'dvo-audio-wrap' },
                React.createElement('button', {
                  type: 'button', className: 'dvo-audio-play',
                  title: isPlaying ? t('pause') : t('play'),
                  'aria-label': isPlaying ? t('pause') : t('play'),
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
          v.settings.autoSendVisualRing !== false
            ? (() => {
                const total = (voice.pending && voice.pending.totalMs) || Number(voice.settings.autoSendMs) || 4000
                const leftMs = (voice.pending && voice.pending.leftMs) || 0
                const frac = total > 0 ? Math.max(0, Math.min(1, leftMs / total)) : 0
                const circ = 2 * Math.PI * 14
                const off = circ * (1 - frac)
                return React.createElement('svg', { className: 'dvo-silence-ring', viewBox: '0 0 34 34' },
                  React.createElement('circle', { cx: 17, cy: 17, r: 14, className: 'dvo-ring-bg' }),
                  React.createElement('circle', {
                    cx: 17, cy: 17, r: 14, className: 'dvo-ring-fg',
                    strokeDasharray: `${circ} ${circ}`,
                    strokeDashoffset: off,
                  }),
                )
              })()
            : null,
          React.createElement('span', { className: 'dvo-status', 'aria-live': 'polite', 'aria-atomic': 'true' }, t('sendingIn')),
          React.createElement('span', { className: 'dvo-count' }, left + t('secondsShort')),
          React.createElement('button', {
            type: 'button', className: 'dvo-pbtn', title: t('keepPending'),
            'aria-label': t('keepPending'),
            onClick: () => {
              keepPending()
              focusComposer()
            },
          }, xIcon()),
        )
      }

      return React.createElement('div', { className: 'dvo-pill', role: 'region', 'aria-label': t('title') },
        React.createElement('span', { className: 'dvo-status dvo-err', 'aria-live': 'polite', 'aria-atomic': 'true' }, warnIcon(), v.error),
        React.createElement('button', {
          type: 'button', className: 'dvo-pbtn', title: t('hide'),
          'aria-label': t('hide'),
          onClick: () => {
            voice.set({ phase: 'idle', error: '' })
            focusComposer()
          },
        }, xIcon()),
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
              voice.hotkey = key || ''
              if (key) dispose = installHotkey(ctx, key, 'message')
              // The composer needs fresh settings without opening the card.
              Object.assign(voice.settings, {
                beep: !!(data && data.beep),
                localOnly: !!(data && data.localOnly),
                webgpuModel: String((data && data.webgpuModel) || (voice.settings && voice.settings.webgpuModel) || 'onnx-community/whisper-tiny'),
                micDeviceId: String((data && data.micDeviceId) || ''),
                historyLimit: Number(data && data.historyLimit),
                voiceCommands: !!(data && data.voiceCommands),
                vadSilenceMs: Number(data && data.modes && data.modes.dictation && data.modes.dictation.vadSilenceMs) || 700,
                autoSendMs: Number(data && data.modes && data.modes.message && data.modes.message.autoSendMs) || 4000,
                dictationMode: String((data && data.dictationMode) || 'clean'),
                dictationPrompts: (data && data.dictationPrompts) || {},
                voiceMacros: Array.isArray(data && data.voiceMacros) ? data.voiceMacros : [],
                sendDelayMs: Number(data && data.modes && data.modes.dictation && data.modes.dictation.sendDelayMs) || 0,
                stream: !!(data && data.modes && data.modes.dictation && data.modes.dictation.stream),
                streamChunkMs: Number(data && data.modes && data.modes.dictation && data.modes.dictation.streamChunkMs) || 1200,
                vadAdapt: Number(data && data.modes && data.modes.dictation && data.modes.dictation.vadAdapt) || 0,
                wakeWord: String((data && data.wakeWord) || ''),
                bargeIn: !!(data && data.bargeIn),
                polishSend: !!(data && data.modes && data.modes.message && data.modes.message.polishSend),
                sessionCommands: !!(data && data.modes && data.modes.message && data.modes.message.sessionCommands),
                noiseSuppression: data && data.noiseSuppression !== false,
                noiseGateDb: Number(data && data.noiseGateDb !== undefined ? data.noiseGateDb : -45),
                contextGlossary: data && data.contextGlossary !== false,
                visualizerStyle: (data && data.visualizerStyle) || 'liquid-wave',
                gatedTurnTaking: data && data.gatedTurnTaking !== false,
                autoSendVisualRing: data && data.autoSendVisualRing !== false,
                voiceActions: data && data.voiceActions !== false,
                techJargonCorrection: data && data.techJargonCorrection !== false,
                jargonDictionary: Array.isArray(data && data.jargonDictionary) ? data.jargonDictionary : [],
                liveInterimPreview: data && data.liveInterimPreview !== false,
                structuredPromptVoice: data && data.structuredPromptVoice !== false,
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
          clearGlobalHotkey()
        }
      }, 'dsh-voice: hold hotkey')

      // locale: NS is required — the core resolves `label` through the inject face,
      // and without it the label throws "cannot get property t without inject" while
      // the slot snapshot is built, breaking the whole client batch.
      ctx.effect(() => {
        const offRight = ctx.slots.inject('conversation.input.right', () => ctx.slots.register(
          { name: 'conversation.input.right', id: '@goodandready/dsh-voice', order: 6, locale: NS, label: () => t('title') },
          (props) => React.createElement(VoiceButtons, { input: props.input, inputActions: props.inputActions }),
        ))
        const offDock = ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
          { name: 'conversation.input.dock', id: 'dsh-voice-rec', order: 0, locale: NS, label: () => t('recordSlot') },
          (props) => React.createElement(RecordPill, { input: props.input, inputActions: props.inputActions, session: props.session, ctx: ctx }),
        ))
        return () => {
          if (typeof offRight === 'function') offRight()
          if (typeof offDock === 'function') offDock()
        }
      }, 'dsh-voice: composer slots')
    }

  // ------------------------------------------------------- settings page
  const BUILTIN = [
   'browser', 'browser-webgpu', 'deepgram', 'groq', 'hf', 'local-whisper', 'sensevoice',
   // Presets: address and model are filled on the host; only a key is needed.
   'openai', 'siliconflow', 'deepinfra', 'fireworks', 'mistral', 'openrouter',
  ]
  const TEMPLATES = ['openai-transcriptions', 'openai-chat-audio']
  // Resolve at render time: t() must not be captured before locale bind.
  const MODEL_HINT_KEYS = {
   browser: 'browserHint',
   'browser-webgpu': 'browserWebGpuHint',
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
   'browser-webgpu': 'onnx-community/whisper-tiny',
   deepgram: 'nova-2',
   groq: 'whisper-large-v3-turbo',
   hf: 'openai/whisper-large-v3',
  }
  function modelHint(provider) {
   const key = MODEL_HINT_KEYS[provider]
   if (key) return t(key)
   return MODEL_HINT_STATIC[provider] || ''
  }
  const SUPPORTED_LANGS = [
   { code: '', labelKey: 'langAuto', defaultLabel: 'auto' },
   { code: 'ru', labelKey: 'langRu', defaultLabel: 'ru' },
   { code: 'en', labelKey: 'langEn', defaultLabel: 'en' },
   { code: 'zh', labelKey: 'langZh', defaultLabel: 'zh' },
   { code: 'uk', labelKey: 'langUk', defaultLabel: 'uk' },
   { code: 'de', labelKey: 'langDe', defaultLabel: 'de' },
  ]
  const LANGS = SUPPORTED_LANGS.map((o) => o.code)

  const SET_CSS =
   '.dvo-settings-root.cb-page,.dvo-settings-root .cb-page{display:flex;flex-direction:column;gap:18px;padding:4px 0 24px;max-width:960px}.dvo-settings-root .cb-section-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:12px}.dvo-settings-root .cb-section-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;justify-content:space-between}.dvo-settings-root .cb-section-desc{font-size:13px;color:var(--dsw-alias-label-secondary);margin-top:-4px;line-height:1.4}.dvo-settings-root .cb-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.dvo-settings-root .cb-grid-2{display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:12px}.dvo-settings-root .cb-badge{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);display:inline-flex;align-items:center;gap:4px;font-weight:500}.dvo-settings-root .cb-badge-ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 8%, transparent)}.dvo-settings-root .cb-badge-warn{border-color:var(--dsw-alias-state-warning-primary);color:var(--dsw-alias-state-warning-primary);background:color-mix(in srgb, var(--dsw-alias-state-warning-primary) 8%, transparent)}.dvo-settings-root .cb-badge-bad,.dvo-settings-root .cb-badge-err{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent)}.dvo-settings-root .cb-input{height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 10px;font-size:13px;box-sizing:border-box}.dvo-settings-root .cb-input:focus{outline:none;border-color:var(--dsw-alias-state-brand-primary)}.dvo-settings-root .cb-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 12px;font-size:13px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .15s ease}.dvo-settings-root .cb-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-4, var(--dsw-alias-bg-layer-2));border-color:var(--dsw-alias-label-dimmed, var(--dsw-alias-border-l2))}.dvo-settings-root .cb-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-color:transparent}.dvo-settings-root .cb-btn-primary:hover:not(:disabled){background:var(--dsw-alias-label-primary) !important;color:var(--dsw-alias-bg-layer-3) !important;opacity:0.88}.dvo-settings-root .cb-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 30%, transparent)}.dvo-settings-root .cb-btn-mini{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:6px;width:28px;height:28px;cursor:pointer;flex:none;display:inline-flex;align-items:center;justify-content:center;padding:0;font-size:13px}.dvo-settings-root .cb-btn-mini:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}.dvo-settings-root .cb-field{display:flex;flex-direction:column;gap:6px;padding:6px 0;font-size:13px;color:var(--dsw-alias-label-primary)}.dvo-settings-root .cb-field select,.dvo-settings-root .cb-field input[type="text"],.dvo-settings-root .cb-field input[type="number"],.dvo-settings-root .cb-field textarea{height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 10px;font-size:13px;box-sizing:border-box}.dvo-settings-root .cb-field textarea{height:auto;padding:8px 10px;font-family:inherit}.dvo-settings-root .cb-check-label{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--dsw-alias-label-primary);user-select:none}.dvo-settings-root .cb-check-label input[type="checkbox"]{width:16px;height:16px;cursor:pointer}.dvo-settings-root .cb-alert-err{padding:10px 14px;border-radius:8px;background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);color:var(--dsw-alias-state-error-primary);font-size:13px}.dvs-wrap{display:flex;flex-direction:column;gap:18px;padding:4px 0;max-width:960px}.dvs-block{display:flex;flex-direction:column;gap:10px}.dvs-h{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}.dvs-sub{font-size:12px;color:var(--dsw-alias-label-secondary)}.dvs-row{display:flex;gap:8px;align-items:center}.dvs-row select,.dvs-row input{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;font-size:13px}.dvs-row .dvs-model{flex:1}.dvs-card{display:flex;flex-direction:column;gap:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:12px}.dvs-card input,.dvs-card select{background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:6px 8px;font-size:13px}.dvs-wait{font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.5;max-width:520px}.dvs-ok{font-size:12px;color:var(--dsw-alias-state-success-primary)}.dvs-bad{font-size:12px;color:var(--dsw-alias-state-error-primary)}.dvo-pcard{list-style:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px}.dvo-phead{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;display:flex;align-items:center;gap:12px;padding:14px 16px}.dvo-pheadtext{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}.dvo-ptitle{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.dvo-pdesc{color:var(--dsw-alias-label-secondary);font-size:13px}.dvo-pchev{flex:none;display:flex;color:var(--dsw-alias-label-secondary);transition:transform .15s ease}.dvo-pcardOpen .dvo-pchev{transform:rotate(180deg)}.dvo-pbody{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:12px}'
  const setCssId = 'dsh-voice/settings.module.css'
  function installSettingsCss() {
   if (typeof document === 'undefined') return () => {}
   let tag = document.querySelector('style[data-dsh-plugin="dsh-voice"][data-plugin-css="' + setCssId + '"]')
   if (!tag) {
    tag = document.createElement('style')
    tag.textContent = SET_CSS
    tag.setAttribute('data-dsh-plugin', 'dsh-voice')
    tag.dataset.pluginCss = setCssId
    document.head.appendChild(tag)
   }
   return () => {
    if (tag && tag.parentNode) tag.parentNode.removeChild(tag)
   }
  }

    function createErrorBoundary() {
   if (!React || typeof React.Component !== 'function') {
    return function NoopBoundary(props) { return props?.children || null }
   }
   return class ErrorBoundary extends React.Component {
    constructor(props) {
     super(props)
     this.state = { hasError: false, error: null }
    }
    static getDerivedStateFromError(error) {
     return { hasError: true, error }
    }
    componentDidCatch(error, errorInfo) {
     console.error('[dsh-voice] React Error:', error, errorInfo)
    }
    render() {
     if (this.state.hasError) {
      return h(
       'div',
       { className: 'cb-alert-err', style: { margin: '12px 0', padding: '14px', borderRadius: '8px' } },
       h('div', { style: { fontWeight: 600, marginBottom: '6px' } }, '⚠️ ' + t('uiError')),
       h('div', { style: { fontSize: '12px', wordBreak: 'break-all' } }, String(this.state.error?.message || this.state.error)),
       h(
        'button',
        {
         type: 'button',
         className: 'cb-btn',
         style: { marginTop: '10px', fontSize: '12px', padding: '4px 10px' },
         onClick: () => this.setState({ hasError: false, error: null }),
        },
        t('retry'),
       ),
      )
     }
     return this.props?.children || null
    }
   }
  }
  const ErrorBoundary = createErrorBoundary()

    // One chain editor: provider+model rows with reordering.
    function ChainEditor(props) {
      const t = (props && props.t) || moduleT
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

      return h('div', { className: 'dvs-block' },
        rows.map((row, i) => h('div', { className: 'dvs-row', key: i },
          h('select', {
            value: row.provider, disabled: !props.writable,
            onChange: (e) => change(i, { provider: e.target.value }),
          }, (options.indexOf(row.provider) < 0 ? options.concat([row.provider]) : options)
            .map((p) => h('option', { key: p, value: p }, p))),
          h('input', {
            className: 'dvs-model', value: row.model || '', disabled: !props.writable,
            placeholder: modelHint(row.provider), onChange: (e) => change(i, { model: e.target.value }),
          }),
          h('button', { type: 'button', className: 'dvs-mini', title: t('up'), disabled: !props.writable, onClick: () => move(i, -1) }, '↑'),
          h('button', { type: 'button', className: 'dvs-mini', title: t('down'), disabled: !props.writable, onClick: () => move(i, 1) }, '↓'),
          h('button', { type: 'button', className: 'dvs-mini', title: t('remove'), disabled: !props.writable, onClick: () => remove(i) }, '×'),
        )),
        h('div', { className: 'dvs-row' },
          h('button', { type: 'button', className: 'dvs-mini', title: t('addProvider'), disabled: !props.writable, onClick: add }, '+'),
          h('span', { className: 'dvs-sub' }, t('chainHint')),
        ),
      )
    }

    // Custom providers: name, API template, where to call, how to authorize.
    function CustomEditor(props) {
      const t = (props && props.t) || moduleT
      const rows = Array.isArray(props.value) ? props.value : []
      const change = (i, patch) => props.onChange(rows.map((r, k) => (k === i ? Object.assign({}, r, patch) : r)))
      const remove = (i) => props.onChange(rows.filter((_, k) => k !== i))
      const add = () => props.onChange(rows.concat([
        { key: '', template: 'openai-transcriptions', baseURL: '', model: '', keyEnv: '', prompt: '' },
      ]))
      const field = (i, row, name, placeholder, wide) => h('input', {
        className: wide ? 'dvs-model' : '', value: row[name] || '', placeholder: placeholder,
        disabled: !props.writable, onChange: (e) => change(i, { [name]: e.target.value }),
      })

      return h('div', { className: 'dvs-block' },
        rows.map((row, i) => h('div', { className: 'dvs-card', key: i },
          h('div', { className: 'dvs-row' },
            field(i, row, 'key', t('customName')),
            h('select', {
              value: row.template || 'openai-transcriptions', disabled: !props.writable,
              onChange: (e) => change(i, { template: e.target.value }),
            }, TEMPLATES.map((tmpl) => h('option', { key: tmpl, value: tmpl }, tmpl))),
            h('button', {
              type: 'button', className: 'dvs-mini', title: t('remove'),
              disabled: !props.writable, onClick: () => remove(i),
            }, '\u00d7'),
          ),
          h('div', { className: 'dvs-row' },
            field(i, row, 'baseURL', 'https://openrouter.ai/api/v1', true),
          ),
          h('div', { className: 'dvs-row' },
            field(i, row, 'model', t('customModel'), true),
            field(i, row, 'keyEnv', t('customKeyName')),
          ),
          row.template === 'openai-chat-audio'
            ? h('div', { className: 'dvs-row' },
              field(i, row, 'prompt', t('customModelHint'), true))
            : null,
        )),
        h('div', { className: 'dvs-row' },
          h('button', {
            type: 'button', className: 'dvs-mini', title: t('addCustom'),
            disabled: !props.writable, onClick: add,
          }, '+'),
          h('span', { className: 'dvs-sub' },
            t('openrouterWarning')),
        ),
      )
    }
    // Provider Telemetry & Latency Dashboard (#266)
    function ProviderDashboard(props) {
      const t = props.t || moduleT
      const statsData = props.statsData || {}
      const recentDiagnostics = props.recentDiagnostics || []
      const [exporting, setExporting] = React.useState(false)
      const [exportMsg, setExportMsg] = React.useState('')

      const exportReport = async () => {
        setExporting(true)
        setExportMsg('')
        try {
          const res = await fetch('/dsh-voice/diagnostics/export')
          const data = await res.json()
          if (!res.ok || !data || !data.ok) {
            throw new Error((data && data.error && data.error.message) || `HTTP ${res.status}`)
          }
          const blob = new Blob([JSON.stringify(data.report || {}, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `dsh-voice-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          setExportMsg('✓ ' + t('diagnosticsExportSuccess'))
        } catch (err) {
          setExportMsg(String(err && err.message ? err.message : err))
        } finally {
          setExporting(false)
        }
      }

      return h('div', { className: 'cb-section-card' },
        h('div', { className: 'cb-section-title' },
          h('span', null, '📊 ' + t('providerDashboard')),
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            h('button', {
              type: 'button',
              className: 'cb-btn',
              style: { fontSize: '12px', padding: '4px 10px' },
              disabled: exporting,
              onClick: exportReport,
            }, exporting ? t('exportingDiagnostics') : ('📥 ' + t('exportDiagnosticsBtn'))),
            h('button', {
              type: 'button', className: 'cb-btn', style: { fontSize: '12px', padding: '4px 8px' },
              onClick: props.onRefresh,
            }, '🔄 ' + t('refreshStats')),
          ),
        ),
        exportMsg ? h('div', {
          className: exportMsg.startsWith('✓') ? 'dvs-ok' : 'cb-alert-err',
          style: { fontSize: '12px' },
        }, exportMsg) : null,
        h('div', { className: 'dvo-dash' },
          h('div', { className: 'dvo-dash-grid' },
            Object.keys(statsData).length === 0
              ? h('div', { className: 'dvs-sub' }, t('idle'))
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
                  return h('div', { key, className: 'dvo-dash-item', title: item.lastError ? `${t('errorPrefix')}: ${item.lastError}` : '' },
                    h('div', { className: 'dvo-dash-name' }, key),
                    h('div', { className: 'dvo-dash-row' },
                      h('span', { className: 'dvo-badge ' + badgeClass }, badgeText),
                      h('span', null, rate + '%'),
                    ),
                    h('div', { className: 'dvo-dash-row' },
                      h('span', null, `${item.successes}/${item.attempts}`),
                      h('span', null, t('successRate')),
                    ),
                  )
                }),
          ),
        ),
        // Per-recognition telemetry breakdown list (#266)
        h('div', { style: { marginTop: '12px', borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: '10px' } },
          h('div', { className: 'dvs-h', style: { marginBottom: '8px' } }, t('recentRecognitionsTitle')),
          recentDiagnostics.length === 0
            ? h('div', { className: 'dvs-sub' }, t('noRecognitionsYet'))
            : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                recentDiagnostics.slice(-5).reverse().map((d) => h('div', {
                  key: d.id,
                  className: 'dvs-card',
                  style: { padding: '8px 12px', fontSize: '12px' },
                },
                  h('div', { className: 'cb-row', style: { justifyContent: 'space-between', alignItems: 'center' } },
                    h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
                      h('span', { className: 'cb-badge ' + (d.success ? 'cb-badge-ok' : 'cb-badge-err') },
                        d.success ? '✓ ' + (d.provider || 'STT') : '✗ ' + (d.error ? d.error.slice(0, 30) : 'fail')
                      ),
                      h('span', { className: 'dvs-sub' }, `[${d.mode}/${d.subMode}]`),
                      d.audioBytes ? h('span', { className: 'dvs-sub' }, t('diagBytes').replace('{bytes}', d.audioBytes)) : null,
                    ),
                    h('span', { style: { fontWeight: '600' } },
                      t('diagTotal').replace('{ms}', d.totalTookMs)
                    ),
                  ),
                  h('div', { className: 'cb-row', style: { gap: '12px', marginTop: '4px', fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } },
                    h('span', null, t('diagVad').replace('{ms}', (d.breakdown && d.breakdown.vadMs) || 0)),
                    h('span', null, t('diagStt').replace('{ms}', (d.breakdown && d.breakdown.sttMs) || 0)),
                    d.breakdown && d.breakdown.polishMs ? h('span', null, t('diagPolish').replace('{ms}', d.breakdown.polishMs)) : null,
                    typeof d.wordCount === 'number' ? h('span', null, t('diagWords').replace('{count}', d.wordCount)) : null,
                  ),
                ))
              ),
          h('div', { className: 'dvs-sub', style: { marginTop: '8px', fontStyle: 'italic' } },
            t('diagExportNotice')
          ),
        ),
      )
    }
// ------------------------------------------------------------------ 72-dictation-modes
// Dictation modes configuration card and prompt template editors (#264)

function DictationModesSection(props) {
  const { t, draft, setTop, writable } = props
  const prompts = (draft && draft.dictationPrompts) || {}
  const currentMode = (draft && draft.dictationMode) || 'clean'

  const setPrompt = (key, val) => {
    const updated = { ...prompts, [key]: val }
    setTop('dictationPrompts', updated)
  }

  const resetPrompts = () => {
    setTop('dictationPrompts', { clean: '', task: '', note: '' })
  }

  return h('div', { className: 'cb-section-card' },
    h('div', { className: 'cb-section-title' },
      h('span', null, '🎙️ ' + t('dictationModeTitle')),
    ),
    h('div', { className: 'cb-field-desc' }, t('dictationModeDesc')),
    h('div', { className: 'cb-grid-2', style: { marginTop: '8px' } },
      ['clean', 'task', 'note', 'verbatim'].map((m) =>
        h('label', { key: m, className: 'cb-check-label' },
          h('input', {
            type: 'radio',
            name: 'dictationMode',
            value: m,
            checked: currentMode === m,
            disabled: !writable,
            onChange: () => setTop('dictationMode', m),
          }),
          getDictationModeLabel(m, t),
        ),
      ),
    ),
    h('div', { style: { marginTop: '12px', borderTop: '1px solid var(--dsw-alias-border-l1)', paddingTop: '10px' } },
      h('div', { className: 'cb-section-title', style: { fontSize: '13px' } },
        h('span', null, t('dictationPromptsTitle')),
        h('button', {
          type: 'button',
          className: 'cb-btn cb-btn-secondary',
          style: { fontSize: '11px', padding: '2px 8px' },
          disabled: !writable,
          onClick: resetPrompts,
        }, t('resetPrompts')),
      ),
      h('div', { className: 'cb-field-desc' }, t('dictationPromptsDesc')),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' } },
        h('div', null,
          h('label', { className: 'cb-label' }, t('promptClean')),
          h('textarea', {
            className: 'cb-input',
            style: { minHeight: '48px', resize: 'vertical' },
            value: prompts.clean || '',
            placeholder: 'Default: punctuation & filler-word cleanup',
            disabled: !writable,
            onChange: (e) => setPrompt('clean', e.target.value),
          }),
        ),
        h('div', null,
          h('label', { className: 'cb-label' }, t('promptTask')),
          h('textarea', {
            className: 'cb-input',
            style: { minHeight: '48px', resize: 'vertical' },
            value: prompts.task || '',
            placeholder: 'Default: structured problem/outcome/constraints/criteria',
            disabled: !writable,
            onChange: (e) => setPrompt('task', e.target.value),
          }),
        ),
        h('div', null,
          h('label', { className: 'cb-label' }, t('promptNote')),
          h('textarea', {
            className: 'cb-input',
            style: { minHeight: '48px', resize: 'vertical' },
            value: prompts.note || '',
            placeholder: 'Default: key points & action items summary',
            disabled: !writable,
            onChange: (e) => setPrompt('note', e.target.value),
          }),
        ),
      ),
    ),
  )
}
  // 5. Hardware & Audio Engines Card
  function HardwareOptionsCard(props) {
   const {
    t = moduleT, draft, setTop, writable, catching, setCatching,
    devices = [], testingMic, toggleTestMic, testLevel = 0,
    gateDbVal, gateThresholdPercent, calibrating, calibrateMsg, calibrateNoise, onClearKey
   } = props

   const [benchmarking, setBenchmarking] = React.useState(false)
   const [benchmarkResult, setBenchmarkResult] = React.useState(null)
   const [benchmarkErr, setBenchmarkErr] = React.useState('')

   const runBenchmark = () => {
  setBenchmarking(true)
  setBenchmarkErr('')
  fetch('/dsh-voice/benchmark', {
   method: 'POST',
   headers: {
   'x-dsh-plugin-update': '1',
   'Content-Type': 'application/json',
   },
  })
   .then((r) => r.json())
   .then((d) => {
   setBenchmarking(false)
   if (d && d.ok) setBenchmarkResult(d)
   else setBenchmarkErr((d && d.error && d.error.message) || 'Benchmark failed')
   })
   .catch((e) => {
   setBenchmarking(false)
   setBenchmarkErr((e && e.message) || 'Network error')
   })
   }

   const textField = (key, label, hint) => h('div', { className: 'cb-field' },
  h('label', null, label),
  h('input', {
   type: 'text', value: draft && draft[key] !== undefined ? draft[key] : '', disabled: !writable,
   onChange: (e) => setTop(key, e.target.value),
  }),
  h('span', { className: 'dvs-sub' }, hint),
   )

   return h('div', { className: 'cb-section-card' },
  h('div', { className: 'cb-section-title' },
   h('span', null, '⚙️ ' + t('hardwareTitle')),
  ),
  h('div', { className: 'cb-section-desc' }, t('hardwareDesc')),
  // Hotkey picker
  h('div', { className: 'cb-field' },
   h('label', null, t('hotkey')),
   h('div', { className: 'cb-row' },
   h('button', {
    type: 'button', className: 'cb-btn cb-btn-primary', disabled: !writable,
    onClick: () => setCatching(true),
   }, catching ? t('pressKey') : keyLabel(draft && draft.hotkey)),
   h('button', {
    type: 'button', className: 'cb-btn cb-btn-mini', title: t('clearKey'),
    disabled: !writable, onClick: onClearKey,
   }, '×'),
   ),
   h('span', { className: 'dvs-sub' }, t('hotkeyHint1') + t('hotkeyHint2')),
  ),
  // Mic & noise gate
  h('div', { className: 'cb-field' },
   h('label', null, t('mic')),
   h('div', { className: 'cb-row' },
   h('select', {
    value: String((draft && draft.micDeviceId) ?? ''), disabled: !writable || testingMic,
    onChange: (e) => setTop('micDeviceId', e.target.value),
    style: { flex: 1 },
   },
    h('option', { value: '' }, t('micDefault')),
    devices.map((d) => h('option', { key: d.deviceId, value: d.deviceId },
    d.label || d.deviceId.slice(0, 12))),
   ),
   h('button', {
    type: 'button',
    className: 'cb-btn ' + (testingMic ? 'cb-btn-primary' : 'cb-btn-secondary'),
    onClick: toggleTestMic,
    style: { flex: 'none' },
   }, testingMic ? t('stopTest') : t('testMic')),
   h('button', {
    type: 'button',
    className: 'cb-btn cb-btn-secondary',
    onClick: () => (typeof calibrateNoise === 'function' ? calibrateNoise(setTop, t) : null),
    disabled: calibrating || !writable,
    style: { flex: 'none' },
    title: t('calibrateNoiseHint') || '',
   }, calibrating ? t('calibrating') : t('calibrateNoise')),
   ),
   calibrateMsg ? h('div', {
    style: { fontSize: '11px', color: 'var(--dsw-alias-state-success-primary)', marginTop: '4px' },
   }, calibrateMsg) : null,
   testingMic ? h('div', { className: 'dvo-mic-test' },
   h('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, t('micLevel') + ':'),
   h('div', { className: 'dvo-meter-bar' },
    h('div', { className: 'dvo-meter-fill', style: { width: `${testLevel}%` } }),
    gateThresholdPercent > 0 ? h('div', { className: 'dvo-meter-gate', style: { left: `${gateThresholdPercent}%` }, title: `${gateDbVal} dB` }) : null,
   ),
   h('span', { style: { fontSize: '11px', fontVariantNumeric: 'tabular-nums', width: '32px', textAlign: 'right' } }, `${testLevel}%`),
   ) : null,
   h('div', { className: 'cb-row', style: { marginTop: '6px' } },
   h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', minWidth: '120px' } }, t('noiseGate') + ':'),
   h('select', {
    value: String(gateDbVal), disabled: !writable,
    onChange: (e) => setTop('noiseGateDb', Number(e.target.value)),
    style: { flex: 1 },
   },
    h('option', { value: '-999' }, t('noiseGateOff')),
    h('option', { value: '-50' }, '-50 dB (Low / Gentle)'),
    h('option', { value: '-45' }, '-45 dB (Standard Default)'),
    h('option', { value: '-35' }, '-35 dB (Medium Room)'),
    h('option', { value: '-25' }, '-25 dB (High / Mechanical Clicks)'),
    !['-999', '-50', '-45', '-35', '-25'].includes(String(gateDbVal)) ? h('option', { value: String(gateDbVal) }, `${gateDbVal} dB (${t('calibratedValue') || 'Calibrated'})`) : null,
   ),
   ),
   h('span', { className: 'dvs-sub' }, t('noiseGateHint')),
  ),
  h('div', { className: 'cb-field' },
   h('label', null, t('vadEngine')),
   h('select', {
    value: (draft && draft.vadEngine) || 'silero', disabled: !writable,
    onChange: (e) => setTop('vadEngine', e.target.value),
   },
    h('option', { value: 'silero' }, t('vadSilero')),
    h('option', { value: 'amplitude' }, t('vadAmplitude')),
   ),
   h('span', { className: 'dvs-sub' }, t('vadEngineHint')),
  ),
  h('div', { className: 'cb-field' },
   h('label', { className: 'cb-check-label' },
    h('input', {
     type: 'checkbox', checked: draft && draft.streamingWs !== false, disabled: !writable,
     onChange: (e) => setTop('streamingWs', e.target.checked),
    }),
    ' ' + t('streamingWs'),
   ),
   h('span', { className: 'dvs-sub' }, t('streamingWsHint')),
  ),
  // Endpoint text fields
  h('div', { className: 'cb-grid-2' },
   textField('whisperUrl', t('whisperEndpoint'), t('whisperEndpointHint')),
   textField('whisperBin', t('whisperBin'), t('whisperBinHint')),
   textField('whisperModel', t('whisperModel'), t('whisperModelHint')),
   textField('deepgramBaseUrl', t('deepgramEndpoint'), t('deepgramEndpointHint')),
   textField('sensevoiceUrl', t('sensevoiceEndpoint'), t('sensevoiceEndpointHint')),
   textField('sensevoiceBin', t('sensevoiceBin'), t('sensevoiceBinHint')),
   textField('sensevoiceModel', t('sensevoiceModel'), t('sensevoiceModelHint')),
   textField('polishBaseUrl', t('polishBaseUrl'), t('polishBaseUrlHint')),
   textField('polishModel', t('polishModel'), ''),
   textField('polishKeyEnv', t('polishKeyEnv'), ''),
  ),
  // Engine checkboxes
  h('div', { className: 'cb-row' },
   h('label', { className: 'cb-check-label' },
   h('input', {
    type: 'checkbox', checked: !!(draft && draft.autoStart), disabled: !writable,
    onChange: (e) => setTop('autoStart', e.target.checked),
   }),
   t('whisperAutostart'),
   ),
   h('label', { className: 'cb-check-label' },
   h('input', {
    type: 'checkbox', checked: !!(draft && draft.sensevoiceAutostart), disabled: !writable,
    onChange: (e) => setTop('sensevoiceAutostart', e.target.checked),
   }),
   t('sensevoiceAutostart'),
   ),
   h('label', { className: 'cb-check-label' },
   h('input', {
    type: 'checkbox', checked: !!(draft && draft.localOnly), disabled: !writable,
    onChange: (e) => setTop('localOnly', e.target.checked),
   }),
   t('localOnly'),
   ),
   h('label', { className: 'cb-check-label' },
   h('input', {
    type: 'checkbox', checked: !!(draft && draft.beep), disabled: !writable,
    onChange: (e) => setTop('beep', e.target.checked),
   }),
   t('beep'),
   ),
   h('label', { className: 'cb-check-label' },
   h('input', {
    type: 'checkbox', checked: draft ? draft.noiseSuppression !== false : true, disabled: !writable,
    onChange: (e) => setTop('noiseSuppression', e.target.checked),
   }),
   t('noiseSuppression'),
   ),
   h('label', { className: 'cb-check-label' },
   h('input', {
    type: 'checkbox', checked: draft ? draft.contextGlossary !== false : true, disabled: !writable,
    onChange: (e) => setTop('contextGlossary', e.target.checked),
   }),
   t('contextGlossary'),
   ),
   h('label', { className: 'cb-check-label', title: t('bilingualDeveloperPromptHint') || '' },
   h('input', {
    type: 'checkbox', checked: draft ? draft.bilingualDeveloperPrompt !== false : true, disabled: !writable,
    onChange: (e) => setTop('bilingualDeveloperPrompt', e.target.checked),
   }),
   t('bilingualDeveloperPrompt'),
   ),
   h('label', { className: 'cb-check-label' },
   h('input', {
    type: 'checkbox', checked: !!(draft && draft.voiceCommands), disabled: !writable,
    onChange: (e) => setTop('voiceCommands', e.target.checked),
   }),
   t('voiceCommandsLabel'),
   ),
   h('label', { className: 'cb-check-label' },
   h('input', {
    type: 'checkbox', checked: !!(draft && draft.normalizeTranscript), disabled: !writable,
    onChange: (e) => setTop('normalizeTranscript', e.target.checked),
   }),
   t('normalizeTranscript'),
   ),
  ),
  // Visualizer select
  h('div', { className: 'cb-field' },
   h('label', null, t('visualizerStyle')),
   h('select', {
   value: String((draft && draft.visualizerStyle) || 'liquid-wave'), disabled: !writable,
   onChange: (e) => setTop('visualizerStyle', e.target.value),
   },
   h('option', { value: 'liquid-wave' }, t('visLiquidWave')),
   h('option', { value: 'dynamic-orb' }, t('visDynamicOrb')),
   h('option', { value: 'bars' }, t('visBars')),
   h('option', { value: 'off' }, t('visOff')),
   ),
  ),
  // Hardware Acceleration (SBC NPU / Host)
  h('div', { className: 'cb-field' },
   h('label', null, t('npuProvider')),
   h('div', { className: 'cb-row' },
   h('select', {
    value: String((draft && draft.sensevoiceProvider) || 'cpu'),
    disabled: !writable,
    onChange: (e) => setTop('sensevoiceProvider', e.target.value),
    style: { flex: 1 },
   },
    h('option', { value: 'cpu' }, 'CPU (Standard)'),
    h('option', { value: 'rknn' }, 'Rockchip RK3588 NPU (RKNN)'),
    h('option', { value: 'coreml' }, 'Apple Silicon CoreML'),
    h('option', { value: 'openvino' }, 'Intel OpenVINO'),
    h('option', { value: 'cuda' }, 'NVIDIA CUDA'),
   ),
   h('input', {
    type: 'number',
    min: 1,
    max: 32,
    value: Number((draft && draft.sensevoiceThreads) || 4),
    disabled: !writable,
    title: t('npuThreads'),
    style: { width: '80px' },
    onChange: (e) => setTop('sensevoiceThreads', Math.max(1, Math.min(32, Number(e.target.value) || 4))),
   }),
   ),
   h('span', { className: 'dvs-sub' }, t('npuProviderHint')),
  ),
  // Hardware Benchmark
  h('div', { className: 'cb-field' },
   h('div', { className: 'cb-row', style: { alignItems: 'center', justifyContent: 'space-between' } },
   h('label', { style: { marginBottom: 0 } }, t('benchmarkTitle')),
   h('button', {
    type: 'button', className: 'cb-btn cb-btn-secondary', style: { fontSize: '12px', padding: '4px 10px' },
    disabled: benchmarking || !writable, onClick: runBenchmark,
   }, benchmarking ? ('⏳ ' + t('benchmarking')) : ('⚡ ' + t('runBenchmarkBtn'))),
   ),
   benchmarkResult
   ? h('div', {
    style: { marginTop: '8px', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', backgroundColor: 'var(--dsw-alias-fill-quaternary)' }
    }, benchmarkResult.running
    ? `⚡ RTF: ${benchmarkResult.rtf}x · ${benchmarkResult.latencyMs}ms (${benchmarkResult.rating}) · ${String(benchmarkResult.provider || 'cpu').toUpperCase()} · Cores: ${benchmarkResult.cpuCores}`
    : `ℹ ${benchmarkResult.message || 'Offline'} (${benchmarkResult.cpuCores} cores, ${benchmarkResult.platform})`)
   : (benchmarkErr ? h('div', { style: { color: 'var(--dsw-alias-state-danger)', fontSize: '12px', marginTop: '4px' } }, benchmarkErr) : null),
   h('span', { className: 'dvs-sub' }, t('benchmarkHint')),
  ),
  // WebGPU Status Indicator
  h('div', { className: 'cb-field' },
   h('label', null, t('webgpuStatus')),
   h('div', {
   style: {
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    backgroundColor: 'var(--dsw-alias-fill-quaternary)',
    color: (typeof isWebGpuSupported === 'function' && isWebGpuSupported())
    ? 'var(--dsw-alias-state-success)'
    : 'var(--dsw-alias-label-secondary)'
   }
   }, (typeof isWebGpuSupported === 'function' && isWebGpuSupported())
    ? ('✓ ' + t('webgpuAvailable'))
    : ('ℹ ' + t('webgpuNotAvailable'))),
  ),
  // Vocabulary textarea
  h('div', { className: 'cb-field' },
   h('label', null, t('vocabulary')),
   h('textarea', {
   rows: 3, disabled: !writable,
   value: Array.isArray(draft && draft.vocabulary) ? draft.vocabulary.join('\n') : '',
   onChange: (e) => setTop('vocabulary', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean)),
   }),
  ),
   )
  }
  // Custom hooks for VoiceSection modularity
  function useSensevoiceInstaller(fetchStatus) {
   const [sensevoiceState, setSensevoiceState] = React.useState(null)
   const [installingSensevoice, setInstallingSensevoice] = React.useState(false)

   const fetchSensevoice = () => {
    fetch('/dsh-voice/sensevoice-installer')
     .then((r) => r.json())
     .then((d) => {
      setSensevoiceState(d)
      setInstallingSensevoice(!!(d && d.installing))
     })
     .catch(() => {})
   }

   React.useEffect(() => {
    fetchSensevoice()
   }, [])

   const triggerInstallSensevoice = (modelType = 'sensevoice') => {
    setInstallingSensevoice(true)
    fetch('/dsh-voice/sensevoice-installer', {
     method: 'POST',
     headers: {
      'x-dsh-plugin-update': '1',
      'Content-Type': 'application/json',
     },
     body: JSON.stringify({ model: modelType }),
    })
     .then((r) => r.json())
     .then(() => {
      const timer = setInterval(() => {
       fetch('/dsh-voice/sensevoice-installer')
        .then((r) => r.json())
        .then((d) => {
         setSensevoiceState(d)
         if (!d.installing) {
          clearInterval(timer)
          setInstallingSensevoice(false)
          if (typeof fetchStatus === 'function') fetchStatus()
         }
        })
        .catch(() => clearInterval(timer))
      }, 2000)
     })
     .catch(() => setInstallingSensevoice(false))
   }

   return { sensevoiceState, installingSensevoice, triggerInstallSensevoice }
  }

  function useMicTester(draft, value, setErr) {
   const [testingMic, setTestingMic] = React.useState(false)
   const [testLevel, setTestLevel] = React.useState(0)
   const [calibrating, setCalibrating] = React.useState(false)
   const [calibrateMsg, setCalibrateMsg] = React.useState('')
   const testRef = React.useRef(null)

   const calibrateNoise = async (setTop, translate) => {
    if (calibrating) return
    setCalibrating(true)
    setCalibrateMsg('')
    let stream = null
    let audioCtx = null
    try {
     const devId = (draft && draft.micDeviceId) || (value && value.micDeviceId) || ''
     const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
     if (devId) audio.deviceId = { exact: devId }
     stream = await navigator.mediaDevices.getUserMedia({ audio })
     const AC = typeof AudioContext !== 'undefined' ? AudioContext : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null)
     if (!AC) throw new Error('AudioContext not supported')
     audioCtx = new AC()
     if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => {})
     const src = audioCtx.createMediaStreamSource(stream)
     const analyser = audioCtx.createAnalyser()
     analyser.fftSize = 512
     src.connect(analyser)

     const samples = []
     const buf = new Float32Array(analyser.fftSize)
     const startTime = Date.now()

     await new Promise((resolve) => {
      const interval = setInterval(() => {
       if (Date.now() - startTime >= 2000) {
        clearInterval(interval)
        resolve()
        return
       }
       analyser.getFloatTimeDomainData(buf)
       let sum = 0
       for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
       const rms = Math.sqrt(sum / buf.length)
       if (rms > 0.00001) {
        samples.push(20 * Math.log10(rms))
       }
      }, 50)
     })

     const avgDb = samples.length > 0 ? (samples.reduce((a, b) => a + b, 0) / samples.length) : -50
     const roundedAvg = Math.round(avgDb)
     const recommended = Math.min(-25, Math.max(-55, roundedAvg + 5))
     if (typeof setTop === 'function') setTop('noiseGateDb', recommended)

     const tFn = typeof translate === 'function' ? translate : (k) => k
     const msg = (tFn('calibratedMsg') || 'Gate set: {db} dB (ambient: {noise} dB)')
      .replace('{db}', String(recommended))
      .replace('{noise}', String(roundedAvg))
     setCalibrateMsg(msg)
     setTimeout(() => setCalibrateMsg(''), 5000)
    } catch (e) {
     if (typeof setErr === 'function') setErr(String(e && e.message ? e.message : e))
    } finally {
     if (stream) {
      try { stream.getTracks().forEach((t) => t.stop()) } catch (e) {}
     }
     if (audioCtx) {
      try { audioCtx.close() } catch (e) {}
     }
     setCalibrating(false)
    }
   }

   const toggleTestMic = async () => {
    if (testingMic) {
     if (testRef.current) {
      testRef.current.active = false
      try { testRef.current.stream.getTracks().forEach((t) => t.stop()) } catch (e) { /* already stopped */ }
      if (testRef.current.audioCtx) { try { testRef.current.audioCtx.close() } catch (e) { /* already closed */ } }
      testRef.current = null
     }
     setTestingMic(false)
     setTestLevel(0)
     return
    }
    try {
     const devId = (draft && draft.micDeviceId) || (value && value.micDeviceId) || ''
     const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
     if (devId) audio.deviceId = { exact: devId }
     const stream = await navigator.mediaDevices.getUserMedia({ audio })
     const AC = typeof AudioContext !== 'undefined' ? AudioContext : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null)
     if (!AC) return
     const audioCtx = new AC()
     if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => {})
     const src = audioCtx.createMediaStreamSource(stream)
     let lastNode = src
     try {
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 80
      filter.Q.value = 0.707
      src.connect(filter)
      lastNode = filter
     } catch (e) { /* filter fallback */ }
     const analyser = audioCtx.createAnalyser()
     analyser.fftSize = 128
     lastNode.connect(analyser)
     testRef.current = { stream, audioCtx, analyser, active: true }
     setTestingMic(true)

     const check = () => {
      if (!testRef.current || !testRef.current.active) return
      const arr = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(arr)
      let sum = 0
      for (let i = 0; i < arr.length; i++) sum += arr[i]
      const avg = sum / (arr.length || 1)
      setTestLevel(Math.min(100, Math.round((avg / 128) * 100)))
      requestAnimationFrame(check)
     }
     requestAnimationFrame(check)
    } catch (e) {
     if (typeof setErr === 'function') setErr(String(e && e.message ? e.message : e))
    }
   }

   React.useEffect(() => {
    return () => {
     if (testRef.current) {
      testRef.current.active = false
      try { testRef.current.stream.getTracks().forEach((t) => t.stop()) } catch (e) { /* already stopped */ }
      if (testRef.current.audioCtx) { try { testRef.current.audioCtx.close() } catch (e) { /* already closed */ } }
      testRef.current = null
     }
    }
   }, [])

   const gateDbVal = Number((draft && draft.noiseGateDb !== undefined) ? draft.noiseGateDb : (value && value.noiseGateDb !== undefined) ? value.noiseGateDb : -45)
   const gateThresholdPercent = gateDbVal <= -90 ? 0 : Math.min(100, Math.max(0, Math.round(((gateDbVal + 60) / 40) * 100)))

   return { testingMic, testLevel, toggleTestMic, gateDbVal, gateThresholdPercent, calibrating, calibrateMsg, calibrateNoise }
  }

  function usePluginUpdater() {
   const [updaterStatus, setUpdaterStatus] = React.useState(null)
   const [updating, setUpdating] = React.useState(false)
   const [updaterMsg, setUpdaterMsg] = React.useState('')
   const [updaterMsgKind, setUpdaterMsgKind] = React.useState('')
   const [updaterLoading, setUpdaterLoading] = React.useState(false)

   const checkUpdater = React.useCallback(async () => {
    setUpdaterLoading(true)
    setUpdaterMsg('')
    setUpdaterMsgKind('')
    try {
     const res = await fetch('/api/dsh-voice/update', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
     })
     if (!res.ok) throw new Error(`HTTP ${res.status}`)
     const data = await res.json()
     setUpdaterStatus(data)
     if (data && data.latestCheckFailed) {
      setUpdaterMsg(t('updateCheckFailed'))
      setUpdaterMsgKind('err')
     }
    } catch (e) {
     setUpdaterStatus(null)
     setUpdaterMsg(t('updateCheckFailed') + ': ' + (e?.message || String(e)))
     setUpdaterMsgKind('err')
    } finally {
     setUpdaterLoading(false)
    }
   }, [])

   const onUpdateNow = async () => {
    if (updating) return
    setUpdating(true)
    setUpdaterMsg('')
    setUpdaterMsgKind('')
    try {
     const res = await fetch('/api/dsh-voice/update', {
      method: 'POST',
      headers: {
       'content-type': 'application/json',
       'x-dsh-plugin-update': '1',
      },
      cache: 'no-store',
     })
     const data = await res.json().catch(() => ({}))
     if (!res.ok || data.ok === false) {
      if (data.code) {
       const base = t('profileLockCheckError')
       throw new Error(base ? `${base} (${data.code})` : (data.error || `HTTP ${res.status}`))
      }
      if (data.locked) {
       const key = data.pid ? 'profileLockedPid' : 'profileLockedExisting'
       const translated = t(key)
       if (translated && translated !== key) {
        throw new Error(data.pid ? translated.replace('{pid}', String(data.pid)) : translated)
       }
      }
      throw new Error(data.error || `HTTP ${res.status}`)
     }
     setUpdaterMsg(data.message || t('updateSuccess'))
     setUpdaterMsgKind('ok')
     checkUpdater()
    } catch (err) {
     setUpdaterMsg(err && err.message ? err.message : String(err))
     setUpdaterMsgKind('err')
    } finally {
     setUpdating(false)
    }
   }

   return { updaterStatus, updating, updaterMsg, updaterMsgKind, updaterLoading, checkUpdater, onUpdateNow }
  }
    // Developer Lexicon & IT Jargon
    function JargonEditor(props) {
      const t = props.t || moduleT
      const draft = props.draft
      const setTop = props.setTop
      const writable = props.writable
      const jargonInput = props.jargonInput
      const setJargonInput = props.setJargonInput

      return h('div', { className: 'cb-section-card' },
        h('div', { className: 'cb-section-title' },
          h('span', null, '📖 ' + t('jargonTitle')),
        ),
        h('label', { className: 'cb-check-label', style: { marginBottom: '8px' } },
          h('input', {
            type: 'checkbox',
            checked: draft ? draft.techJargonCorrection !== false : true,
            disabled: !writable,
            onChange: (e) => setTop('techJargonCorrection', e.target.checked),
          }),
          t('techJargonCorrection'),
        ),
        h('div', { className: 'cb-field' },
          h('label', null, t('jargonAdd') + t('jargonFormatHint')),
          h('textarea', {
            rows: 3,
            disabled: !writable,
            placeholder: t('jargonPlaceholder'),
            value: jargonInput !== null && jargonInput !== undefined
              ? jargonInput
              : (Array.isArray(draft && draft.jargonDictionary)
                  ? draft.jargonDictionary.map((item) => item && item.from ? `${item.from} -> ${item.to}` : '').filter(Boolean).join('\n')
                  : ''),
            onChange: (e) => setJargonInput && setJargonInput(e.target.value),
            onBlur: () => {
              if (jargonInput === null || jargonInput === undefined) return
              const lines = jargonInput.split('\n')
              const parsed = lines
                .map((line) => {
                  const parts = line.split(/->|=|:/)
                  if (parts.length >= 2) {
                    const from = parts[0].trim()
                    const to = parts.slice(1).join(':').trim()
                    if (from && to) return { from, to }
                  }
                  return null
                })
                .filter(Boolean)
              setTop('jargonDictionary', parsed)
            },
          }),
        ),
      )
    }
// ------------------------------------------------------------------ 72-macros
// Voice action macros configuration card (#167)

function MacrosSection(props) {
  const { t, draft, setTop, writable } = props
  const macros = Array.isArray(draft && draft.voiceMacros) ? draft.voiceMacros : []

  const addMacro = () => {
    const next = [...macros, { trigger: '', template: '' }]
    setTop('voiceMacros', next)
  }

  const updateMacro = (idx, field, val) => {
    const next = macros.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    setTop('voiceMacros', next)
  }

  const removeMacro = (idx) => {
    const next = macros.filter((_, i) => i !== idx)
    setTop('voiceMacros', next)
  }

  return h('div', { className: 'cb-section-card' },
    h('div', { className: 'cb-section-title' },
      h('span', null, '⚡ ' + t('voiceMacrosTitle')),
      h('button', {
        type: 'button',
        className: 'cb-btn cb-btn-secondary',
        style: { fontSize: '11px', padding: '2px 8px' },
        disabled: !writable,
        onClick: addMacro,
      }, '+ ' + t('addMacro')),
    ),
    h('div', { className: 'cb-field-desc' }, t('voiceMacrosDesc')),
    macros.length === 0
      ? h('div', { style: { fontStyle: 'italic', color: 'var(--dsw-alias-label-tertiary)', fontSize: '12px', marginTop: '6px' } },
          'No macros configured.',
        )
      : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' } },
          macros.map((m, idx) =>
            h('div', { key: idx, className: 'dvo-macro-item' },
              h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
                h('input', {
                  type: 'text',
                  className: 'cb-input',
                  style: { flex: '1', height: '28px', fontSize: '12px' },
                  placeholder: t('macroTrigger'),
                  value: m.trigger || '',
                  disabled: !writable,
                  onChange: (e) => updateMacro(idx, 'trigger', e.target.value),
                }),
                h('button', {
                  type: 'button',
                  className: 'cb-btn cb-btn-secondary',
                  style: { padding: '2px 6px', fontSize: '11px', color: 'var(--dsw-alias-state-error-primary)' },
                  disabled: !writable,
                  onClick: () => removeMacro(idx),
                }, t('macroDelete')),
              ),
              h('textarea', {
                className: 'cb-input',
                style: { minHeight: '38px', resize: 'vertical', fontSize: '12px' },
                placeholder: t('macroTemplate') + ' (use {text} for argument)',
                value: m.template || '',
                disabled: !writable,
                onChange: (e) => updateMacro(idx, 'template', e.target.value),
              }),
            ),
          ),
        ),
  )
}
    // Local ASR (SenseVoice-Small & Whisper Large-v3-Turbo 1-Click Setup)
    function SensevoiceSection(props) {
      const t = props.t || moduleT
      const sensevoiceState = props.sensevoiceState
      const installingSensevoice = props.installingSensevoice
      const writable = props.writable
      const onInstall = props.onInstall
      const [modelChoice, setModelChoice] = React.useState('sensevoice')

      const isInstalled = Boolean(sensevoiceState && sensevoiceState.installed)
      const currentType = (sensevoiceState && sensevoiceState.modelType) || 'sensevoice'
      const badgeText = isInstalled
        ? (t('sensevoiceReady') + (currentType === 'whisper-turbo' ? ' (whisper-turbo)' : ' (small-int8)'))
        : (installingSensevoice ? t('sensevoiceDownloading') : t('sensevoiceNotInstalled'))

      return h('div', { className: 'cb-section-card' },
        h('div', { className: 'cb-section-title' },
          h('span', null, '⚡ ' + t('sensevoiceTitle')),
          h('span', { className: 'cb-badge ' + (isInstalled ? 'cb-badge-ok' : 'cb-badge-warn') }, badgeText),
        ),
        h('div', { className: 'cb-section-desc' }, t('sensevoiceDesc')),
        h('div', { className: 'dvo-installer-box' },
          h('div', { className: 'cb-row', style: { alignItems: 'center', justifyContent: 'space-between', gap: '12px' } },
            h('select', {
              value: modelChoice,
              disabled: installingSensevoice || !writable,
              onChange: (e) => setModelChoice(e.target.value),
              style: { flex: 1, fontSize: '12px', minWidth: '180px' },
            },
              h('option', { value: 'sensevoice' }, 'SenseVoice-Small (150MB, ~50ms)'),
              h('option', { value: 'whisper-turbo' }, 'Whisper Large-v3-Turbo (800MB, High-Accuracy)'),
            ),
            h('button', {
              type: 'button',
              className: 'cb-btn cb-btn-primary',
              style: { fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' },
              disabled: installingSensevoice || !writable,
              onClick: () => { if (typeof onInstall === 'function') onInstall(modelChoice) },
            }, installingSensevoice ? ('⏳ ' + t('installingSensevoice')) : ('📥 ' + t('installSensevoice'))),
          ),
          h('div', { style: { fontSize: '11px', marginTop: '6px', color: 'var(--dsw-alias-content-secondary)' } },
            sensevoiceState && sensevoiceState.path
              ? ('~/' + sensevoiceState.path.replace(/^.*[\\/](\.dsh[\\/]models[\\/].*)$/, '$1'))
              : ('~/.dsh/models/' + modelChoice)
          ),
          installingSensevoice
            ? h('div', { style: { marginTop: '8px' } },
                h('div', { className: 'dvo-progress-bar' },
                  h('div', { className: 'dvo-progress-bar-fill' })
                ),
                h('div', { style: { fontSize: '11px', marginTop: '4px', color: 'var(--dsw-alias-content-secondary)' } },
                  (sensevoiceState && sensevoiceState.progress) || t('sensevoiceDownloading')
                )
              )
            : null
        )
      )
    }
    // 1. Connection & Engine Status Card
    function ConnectionStatusCard(props) {
      const t = props.t || moduleT
      const hostOnline = props.hostOnline
      const statusLatency = props.statusLatency
      const whisperRunning = props.whisperRunning
      const providerCount = props.providerCount
      const onRefresh = props.onRefresh
      const onOpenWizard = props.onOpenWizard

      return h('div', { className: 'cb-section-card' },
        h('div', { className: 'cb-section-title' },
          h('span', null, t('statusTitle')),
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            onOpenWizard ? h('button', {
              type: 'button', className: 'cb-btn cb-btn-primary', style: { fontSize: '12px', padding: '4px 10px' },
              onClick: onOpenWizard,
            }, '✨ ' + t('wizardBtnLaunch')) : null,
            h('button', {
              type: 'button', className: 'cb-btn', style: { fontSize: '12px', padding: '4px 8px' },
              onClick: onRefresh,
            }, '🔄 ' + t('refreshStats')),
          ),
        ),
        h('div', { className: 'cb-row', style: { alignItems: 'center', gap: '12px', flexWrap: 'wrap' } },
          h('span', { className: 'cb-badge ' + (hostOnline ? 'cb-badge-ok' : 'cb-badge-err') },
            hostOnline ? (`✓ ${t('hostOnline')} (${statusLatency}ms)`) : (`✗ ${t('hostOffline')}`)
          ),
          h('span', { className: 'cb-badge ' + (whisperRunning ? 'cb-badge-ok' : 'cb-badge-warn') },
            whisperRunning ? (`✓ ${t('whisperReady')}`) : (`· ${t('whisperStopped')}`)
          ),
          h('span', { className: 'cb-badge' }, `${providerCount} ${t('providersAvailable')}`),
        ),
      )
    }
    // Plugin Version & Updates Card
    function UpdaterCard(props) {
      const t = props.t || moduleT
      const updaterStatus = props.updaterStatus
      const updaterLoading = props.updaterLoading
      const updating = props.updating
      const updaterMsg = props.updaterMsg
      const updaterMsgKind = props.updaterMsgKind
      const onCheck = props.onCheck
      const onUpdateNow = props.onUpdateNow

      return h('div', { className: 'cb-section-card' },
        h('div', { className: 'cb-section-title' },
          h('span', null, '📦 ' + t('versionTitle')),
          h('button', {
            type: 'button', className: 'cb-btn', style: { fontSize: '12px', padding: '4px 8px' },
            onClick: onCheck, disabled: updaterLoading || updating,
          }, updaterLoading ? '⏳…' : '🔄 ' + t('refreshStats')),
        ),
        h('div', { className: 'cb-section-desc' }, t('versionHint')),
        h('div', { className: 'cb-row', style: { alignItems: 'center', gap: '12px' } },
          updaterStatus && updaterStatus.currentVersion
            ? h('span', { className: 'cb-badge cb-badge-ok' }, 'v' + updaterStatus.currentVersion)
            : null,
          updaterLoading && (!updaterStatus || !updaterStatus.currentVersion)
            ? h('span', { className: 'cb-badge' }, '⏳ ' + t('checkingUpdates'))
            : !updaterStatus
              ? h('span', { className: 'cb-badge cb-badge-warn' }, '❓ ' + t('updateStatusUnknown'))
              : updaterStatus.updateAvailable
                ? h('span', { className: 'cb-badge cb-badge-warn' },
                    t('updateAvailable') + ': v' + updaterStatus.latestVersion
                  )
                : updaterStatus.latestCheckFailed
                  ? h('span', { className: 'cb-badge cb-badge-warn' },
                      '⚠️ ' + t('updateCheckFailed')
                    )
                  : h('span', { className: 'cb-badge cb-badge-ok' },
                      t('upToDate')
                    ),
          updaterStatus && updaterStatus.updateAvailable
            ? h('button', {
                type: 'button', className: 'cb-btn cb-btn-primary', style: { fontSize: '12px', padding: '4px 10px' },
                onClick: onUpdateNow, disabled: updating,
              }, updating ? t('updating') : t('updateNow'))
            : null,
        ),
        updaterMsg
          ? h('div', {
              style: {
                marginTop: '8px',
                fontSize: '12px',
                color: (updaterMsgKind === 'err' || (!updaterMsgKind && (updaterMsg.includes('fail') || updaterMsg.includes('失败'))))
                  ? 'var(--dsw-alias-state-warning-primary)'
                  : 'var(--dsw-alias-state-success-primary)',
              },
            }, updaterMsg)
          : null,
      )
    }
  // ------------------------------------------------------- settings voice section
  function VoiceSection(props) {
   const t = (props && props.t) || moduleT
   const ctx = (props && props.ctx) || {}
   // On a non-localhost page the kernel disables settings entirely: the
   // shared document is not readable, every section gets "unavailable" and
   // writes are dropped. The server does not share that restriction, and
   // dsh-lanmode rebuilds the same mechanics on the same calls. Prefer its
   // service when installed, otherwise the kernel one (fine on loopback).
   const settingsService = (ctx.get && ctx.get('lanSettings')) || ctx.configForms || ctx.settingsScope
   const scope = settingsService && typeof settingsService.get === 'function'
    ? settingsService.get(NS)
    : (settingsService && typeof settingsService.bind === 'function' ? settingsService.bind({ namespace: NS }) : null)
   const [snap, setSnap] = React.useState(null)
   const [draft, setDraft] = React.useState(null)
   const [saved, setSaved] = React.useState(false)
   const [err, setErr] = React.useState('')
   const [serverConfig, setServerConfig] = React.useState(null)
   const [configLoading, setConfigLoading] = React.useState(true)
   const [revision, setRevision] = React.useState(null)
   React.useEffect(() => {
    let alive = true
    fetch('/dsh-voice/config', { cache: 'no-store' })
     .then((r) => r.json())
     .then((data) => {
      if (alive && data && data.ok && data.config) {
       setServerConfig(data.config)
       if (typeof data.revision === 'number') setRevision(data.revision)
       setDraft((curr) => curr || deepClone(data.config))
       if (data.config.wizardCompleted !== true) setShowWizard(true)
      }
     })
     .catch(() => {})
     .finally(() => {
      if (alive) setConfigLoading(false)
     })
    return () => { alive = false }
   }, [])
   // Hotkey picker: not a name field — press the key you want.
   const [catching, setCatching] = React.useState(false)
   const [jargonInput, setJargonInput] = React.useState(null)
   const [showWizard, setShowWizard] = React.useState(false)
   React.useEffect(() => {
    if (!catching) return undefined
    const onKey = (event) => {
     event.preventDefault()
     event.stopPropagation()
     if (event.key === 'Escape') { setCatching(false); return }
     const chosen = keyFromEvent(event)
     setDraft((d) => Object.assign({}, d || {}, { hotkey: chosen }))
     voice.hotkey = chosen || ''
     if (chosen) {
      installHotkey(ctx, chosen, 'message')
     } else {
      clearGlobalHotkey()
     }
     setCatching(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
   }, [catching, ctx])
   React.useEffect(() => {
    let alive = true
    const render = () => { if (alive && scope && typeof scope.getSnapshot === 'function') setSnap(scope.getSnapshot()) }
    render()
    const off = (scope && typeof scope.subscribe === 'function') ? scope.subscribe(render) : () => {}
    return () => { alive = false; off() }
   }, [scope])
   const [devices, setDevices] = React.useState([])
   React.useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return
    navigator.mediaDevices.enumerateDevices()
     .then((list) => setDevices(list.filter((d) => d.kind === 'audioinput')))
     .catch(() => {})
   }, [])
   const ready = !!serverConfig || (!!snap && snap.status === 'ready')
   const value = (snap && snap.status === 'ready' && snap.value) ? snap.value : (serverConfig || {})
   const writable = ready
   React.useEffect(() => {
    if (ready) return undefined
    let tries = 0
    const timer = setInterval(() => {
     if (tries >= 15) { clearInterval(timer); return }
     tries += 1
     try {
      if (ctx.configForms && typeof ctx.configForms.describe === 'function') {
       ctx.configForms.describe().load()
      } else if (ctx.settingsScope && typeof ctx.settingsScope.describe === 'function') {
       ctx.settingsScope.describe().load()
      }
     } catch (e) { /* service not up yet */ }
    }, 1000)
    return () => clearInterval(timer)
   }, [ready])
   const deepClone = (obj) => {
    if (typeof structuredClone === 'function') {
     try { return structuredClone(obj) } catch (e) { /* fallback */ }
    }
    try { return JSON.parse(JSON.stringify(obj)) } catch (e) { return Object.assign({}, obj) }
   }
   const setTop = (key, val) => {
    setDraft((d) => Object.assign({}, d || {}, { [key]: val }))
   }
   const setIn = (mode, key, val) => {
    setDraft((d) => {
     const next = Object.assign({}, d || {})
     next[mode] = Object.assign({}, next[mode] || {}, { [key]: val })
     return next
    })
   }
   const textField = (key, label, hint) => h('div', { className: 'cb-field' },
    h('label', null, label),
    h('input', {
     type: 'text',
     value: (draft && draft[key]) ?? '',
     disabled: !writable,
     onChange: (e) => setTop(key, e.target.value),
    }),
    hint ? h('span', { className: 'dvs-sub' }, hint) : null,
   )
   React.useEffect(() => { if (ready && draft === null) setDraft(deepClone(value)) }, [ready, draft, value])
   React.useEffect(() => {
    if (!ready) return
    const val = value || {}
    voice.settings = Object.assign({}, voice.settings, {
     vadSilenceMs: Number(val.dictation && val.dictation.vadSilenceMs) || 700,
     autoSendMs: Number(val.message && val.message.autoSendMs) || 4000,
     beep: !!val.beep,
     localOnly: !!val.localOnly,
     micDeviceId: String(val.micDeviceId || ''),
     historyLimit: Number(val.historyLimit) || 20,
     voiceCommands: !!val.voiceCommands,
     sendDelayMs: Number(val.dictation && val.dictation.sendDelayMs) || 0,
     stream: !!(val.dictation && val.dictation.stream),
     streamChunkMs: Number(val.dictation && val.dictation.streamChunkMs) || 1200,
     vadAdapt: Number(val.dictation && val.dictation.vadAdapt) || 0,
     wakeWord: String(val.wakeWord || ''),
     bargeIn: !!val.bargeIn,
     polishSend: !!(val.message && val.message.polishSend),
     editablePreview: val.message ? val.message.editablePreview !== false : true,
     sessionCommands: !!(val.message && val.message.sessionCommands),
     polishBaseUrl: String(val.polishBaseUrl || ''),
     noiseSuppression: val.noiseSuppression !== false,
     noiseGateDb: Number(val.noiseGateDb !== undefined ? val.noiseGateDb : -45), bilingualDeveloperPrompt: val.bilingualDeveloperPrompt !== false,
     contextGlossary: val.contextGlossary !== false,
     visualizerStyle: val.visualizerStyle || 'liquid-wave',
     gatedTurnTaking: val.gatedTurnTaking !== false,
     autoSendVisualRing: val.autoSendVisualRing !== false,
     voiceActions: val.voiceActions !== false,
     techJargonCorrection: val.techJargonCorrection !== false,
     liveInterimPreview: val.liveInterimPreview !== false,
     structuredPromptVoice: val.structuredPromptVoice !== false,
     dictationMode: val.dictationMode || 'clean',
     dictationPrompts: val.dictationPrompts || {},
     voiceMacros: Array.isArray(val.voiceMacros) ? val.voiceMacros : [],
     webgpuModel: String(val.webgpuModel || (voice.settings && voice.settings.webgpuModel) || 'onnx-community/whisper-tiny'),
    })
   }, [ready, value])
   const [statusData, setStatusData] = React.useState(null)
   const [statusLatency, setStatusLatency] = React.useState(null)
   const fetchStatus = React.useCallback(() => {
    const start = performance.now()
    const ctrl = new AbortController()
    const tId = setTimeout(() => ctrl.abort(), 5000)
    fetch('/dsh-voice/status', { cache: 'no-store', signal: ctrl.signal })
     .then((r) => r.json())
     .then((data) => {
      clearTimeout(tId)
      setStatusLatency(Math.round(performance.now() - start))
      if (data && data.ok) {
       setStatusData(data)
       if (data.sessionToken && typeof window !== 'undefined') window.__dshVoiceToken = data.sessionToken
       if (data.webgpuModel && voice.settings) {
        voice.settings.webgpuModel = data.webgpuModel
       }
      }
     })
     .catch(() => {
      clearTimeout(tId)
      setStatusLatency(null)
     })
   }, [])
   React.useEffect(() => {
    fetchStatus()
   }, [fetchStatus])
   const { sensevoiceState, installingSensevoice, triggerInstallSensevoice } = useSensevoiceInstaller(fetchStatus)
   const { testingMic, testLevel, toggleTestMic, gateDbVal, gateThresholdPercent, calibrating, calibrateMsg, calibrateNoise } = useMicTester(draft, value, setErr)
   const { updaterStatus, updating, updaterMsg, updaterMsgKind, updaterLoading, checkUpdater, onUpdateNow } = usePluginUpdater()
   const save = async () => {
    setErr(''); setSaved(false)
    if (!draft) return
    if (jargonInput !== null) {
     const lines = jargonInput.split('\n')
     const parsed = lines
      .map((line) => {
       const parts = line.split(/->|=|:/)
       if (parts.length >= 2) {
        const from = parts[0].trim()
        const to = parts.slice(1).join(':').trim()
        if (from && to) return { from, to }
       }
       return null
      })
      .filter(Boolean)
     draft.jargonDictionary = parsed
    }
    let httpOk = false
    let httpError = null
    try {
     const res = await fetch('/dsh-voice/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: draft, expectedRevision: (typeof revision === 'number' ? revision : undefined) }),
     })
     const data = await res.json()
     if (res.ok && data && data.ok) {
      httpOk = true
      if (data.config) setServerConfig(data.config)
      if (typeof data.revision === 'number') setRevision(data.revision)
     } else if (res.status === 409) {
      httpError = data?.error?.message || 'Settings conflict: parallel changes detected'
     } else {
      httpError = data?.error?.message || data?.error || res.statusText || 'Save failed'
     }
    } catch (e) {
     httpError = e?.message || String(e)
    }
    if (httpOk && scope && typeof scope.set === 'function') {
     for (const k of Object.keys(draft)) {
      try {
       await scope.set(k, draft[k])
      } catch (e) {
       /* best effort on loopback */
      }
     }
    }
    if (!httpOk) {
     setErr(t('saveFailed') + ': ' + httpError)
     return
    }
    const d = draft || {}
    voice.hotkey = d.hotkey || ''
    if (voice.hotkey) {
     installHotkey(ctx, voice.hotkey, 'message')
    } else {
     clearGlobalHotkey()
    }
    Object.assign(voice.settings, {
     hotkey: d.hotkey || '',
     vadSilenceMs: Number(d.dictation && d.dictation.vadSilenceMs) || 700,
     autoSendMs: Number(d.message && d.message.autoSendMs) || 4000,
     beep: !!d.beep,
     micDeviceId: String(d.micDeviceId || ''),
     historyLimit: Number(d.historyLimit),
     voiceCommands: !!d.voiceCommands,
     sendDelayMs: Number(d.dictation && d.dictation.sendDelayMs) || 0,
     stream: !!(d.dictation && d.dictation.stream),
     streamChunkMs: Number(d.dictation && d.dictation.streamChunkMs) || 1200,
     vadAdapt: Number(d.dictation && d.dictation.vadAdapt) || 0,
     noiseSuppression: d.noiseSuppression !== false,
     noiseGateDb: Number(d.noiseGateDb !== undefined ? d.noiseGateDb : -45), bilingualDeveloperPrompt: d.bilingualDeveloperPrompt !== false,
     contextGlossary: d.contextGlossary !== false,
     visualizerStyle: d.visualizerStyle || 'liquid-wave',
     gatedTurnTaking: d.gatedTurnTaking !== false,
     autoSendVisualRing: d.autoSendVisualRing !== false,
     voiceActions: d.voiceActions !== false,
     techJargonCorrection: d.techJargonCorrection !== false,
     liveInterimPreview: d.liveInterimPreview !== false,
     structuredPromptVoice: d.structuredPromptVoice !== false,
    })
    try { window.dispatchEvent(new CustomEvent('dsh-voice:settings-saved')) } catch (noEvents) { /* nobody */ }
    setSaved(true); setJargonInput(null)
    setTimeout(() => setSaved(false), 2000)
    fetchStatus()
   }
   const modeVal = (mode, key, fallback) => {
    const m = draft && draft[mode]
    return m && m[key] !== undefined ? m[key] : fallback
   }
   const chainOptions = BUILTIN.concat(
    (draft && Array.isArray(draft.customProviders) ? draft.customProviders : [])
     .map((c) => String(c && c.key || '').trim())
     .filter((k) => k && BUILTIN.indexOf(k) < 0),
   )
   const langField = (mode) => {
    const val = modeVal(mode, 'language', '')
    const opts = SUPPORTED_LANGS.slice()
    if (val && !opts.some((o) => o.code === val)) {
     opts.push({ code: val, labelKey: val, defaultLabel: val })
    }
    return h('div', { className: 'cb-field' },
     h('label', null, t('language')),
     h('select', {
      value: val, disabled: !writable,
      onChange: (e) => setIn(mode, 'language', e.target.value),
     }, opts.map((o) => h('option', { key: o.code || 'auto', value: o.code },
      t(o.labelKey) !== o.labelKey ? t(o.labelKey) : o.defaultLabel
     ))),
    )
   }
   const numField = (mode, key, label, hint) => h('div', { className: 'cb-field' },
    h('label', null, label),
    h('input', {
     type: 'number', value: modeVal(mode, key, ''), disabled: !writable,
     onChange: (e) => setIn(mode, key, Number(e.target.value)),
    }),
    h('span', { className: 'dvs-sub' }, hint),
   )
   const statsData = (statusData && statusData.providerStats) || {}
   const recentDiagnostics = (statusData && statusData.recentDiagnostics) || []
   const hostOnline = statusLatency !== null
   const whisperRunning = !!(statusData && statusData.whisperRunning)
   const providerCount = (statusData && Array.isArray(statusData.providers)) ? statusData.providers.length : chainOptions.length
   return h('div', { className: 'cb-page dvo-settings-root' },
    h(ConnectionStatusCard, {
     t: t,
     hostOnline: hostOnline,
     statusLatency: statusLatency,
     whisperRunning: whisperRunning,
     providerCount: providerCount,
     onRefresh: fetchStatus,
     onOpenWizard: () => setShowWizard((v) => !v),
    }),
    showWizard ? h(FirstRunWizard, {
     t: t,
     draft: draft,
     setTop: setTop,
     writable: writable,
     onClose: () => setShowWizard(false),
    }) : null,
    h('div', { className: 'cb-section-card' },
     h('div', { className: 'cb-section-title' },
      h('span', null, '🎙️ ' + t('dictationBtn')),
     ),
     h('div', { className: 'cb-section-desc' }, t('dictationHint')),
     React.createElement(ChainEditor, {
      t: t, value: draft && draft.dictation ? draft.dictation.chain : [], writable: writable,
      options: chainOptions,
      onChange: (v) => setIn('dictation', 'chain', v),
     }),
     h('div', { className: 'cb-grid-2' },
      langField('dictation'),
      numField('dictation', 'vadSilenceMs', t('pauseMs'), t('pauseHint')),
      numField('dictation', 'sendDelayMs', t('sendDelay'), t('sendDelayHint')),
      numField('dictation', 'streamChunkMs', t('streamChunkMs'), t('streamHint')),
     ),
     h('div', { className: 'cb-row' },
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox', checked: !!(draft && draft.dictation && draft.dictation.polish), disabled: !writable,
        onChange: (e) => setIn('dictation', 'polish', e.target.checked),
       }),
       t('polish'),
      ),
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox', checked: !!(draft && draft.dictation && draft.dictation.stream), disabled: !writable,
        onChange: (e) => setIn('dictation', 'stream', e.target.checked),
       }),
       t('stream'),
      ),
     ),
     h('div', { className: 'cb-field' },
      h('label', null, t('vadAdapt')),
      h('input', {
       type: 'range', min: 0, max: 1, step: 0.1,
       value: Number(draft && draft.dictation && draft.dictation.vadAdapt) || 0, disabled: !writable,
       onChange: (e) => setIn('dictation', 'vadAdapt', Number(e.target.value)),
      }),
      h('span', { className: 'dvs-sub' }, t('vadAdaptHint')),
     ),
     textField('wakeWord', t('wakeWord'), t('wakeWordHint')),
    ),
    h('div', { className: 'cb-section-card' },
     h('div', { className: 'cb-section-title' },
      h('span', null, '💬 ' + t('messageTitle')),
     ),
     h('div', { className: 'cb-section-desc' }, t('messageHint')),
     React.createElement(ChainEditor, {
      t: t, value: draft && draft.message ? draft.message.chain : [], writable: writable,
      options: chainOptions,
      onChange: (v) => setIn('message', 'chain', v),
     }),
     h('div', { className: 'cb-grid-2' },
      langField('message'),
      numField('message', 'autoSendMs', t('undoMs'), t('undoHint')),
     ),
     h('div', { className: 'cb-row' },
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox', checked: !!(draft && draft.message && draft.message.polish), disabled: !writable,
        onChange: (e) => setIn('message', 'polish', e.target.checked),
       }),
       t('polish'),
      ),
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox', checked: !!(draft && draft.message && draft.message.polishSend), disabled: !writable,
        onChange: (e) => setIn('message', 'polishSend', e.target.checked),
       }),
       t('polishSend'),
      ),
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox', checked: !!(draft && draft.message && draft.message.sessionCommands), disabled: !writable,
        onChange: (e) => setIn('message', 'sessionCommands', e.target.checked),
       }),
       t('sessionCommands'),
      ),
     ),
    ),
    h('div', { className: 'cb-section-card' },
     h('div', { className: 'cb-section-title' },
      h('span', null, '⚙️ ' + t('customTitle')),
     ),
     h('div', { className: 'cb-section-desc' }, t('customHint')),
     React.createElement(CustomEditor, {
      value: draft && draft.customProviders ? draft.customProviders : [], writable: writable,
      options: chainOptions,
      onChange: (v) => setTop('customProviders', v),
     }),
    ),
    h(HardwareOptionsCard, {
     t: t,
     draft: draft,
     setTop: setTop,
     writable: writable,
     catching: catching,
     setCatching: setCatching,
     devices: devices,
     testingMic: testingMic,
     toggleTestMic: toggleTestMic,
     testLevel: testLevel,
     gateDbVal: gateDbVal,
     gateThresholdPercent: gateThresholdPercent,
     calibrating: calibrating,
     calibrateMsg: calibrateMsg,
     calibrateNoise: calibrateNoise,
     onClearKey: () => {
      setDraft((d) => Object.assign({}, d || {}, { hotkey: '' }))
      voice.hotkey = ''
      clearGlobalHotkey()
     },
    }),
    h(SensevoiceSection, {
     t: t,
     sensevoiceState: sensevoiceState,
     installingSensevoice: installingSensevoice,
     writable: writable,
     onInstall: triggerInstallSensevoice,
    }),
    h('div', { className: 'cb-section-card' },
     h('div', { className: 'cb-section-title' },
      h('span', null, '🎙️ ' + t('turnTakingTitle')),
     ),
     h('div', { className: 'cb-section-desc' }, t('turnTakingDesc')),
     h('div', { className: 'cb-grid-2' },
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox',
        checked: draft ? draft.gatedTurnTaking !== false : true,
        disabled: !writable,
        onChange: (e) => setTop('gatedTurnTaking', e.target.checked),
       }),
       t('gatedTurnTaking'),
      ),
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox',
        checked: !!(draft && draft.bargeIn),
        disabled: !writable,
        onChange: (e) => setTop('bargeIn', e.target.checked),
       }),
       t('bargeInDesc'),
      ),
     ),
    ),
    h('div', { className: 'cb-section-card' },
     h('div', { className: 'cb-section-title' },
      h('span', null, '✨ ' + t('smartActionsTitle')),
     ),
     h('div', { className: 'cb-grid-2' },
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox',
        checked: draft ? draft.liveInterimPreview !== false : true,
        disabled: !writable,
        onChange: (e) => setTop('liveInterimPreview', e.target.checked),
       }),
       t('liveInterimPreview'),
      ),
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox',
        checked: draft ? draft.autoSendVisualRing !== false : true,
        disabled: !writable,
        onChange: (e) => setTop('autoSendVisualRing', e.target.checked),
       }),
       t('autoSendVisualRing'),
      ),
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox',
        checked: draft ? draft.voiceActions !== false : true,
        disabled: !writable,
        onChange: (e) => setTop('voiceActions', e.target.checked),
       }),
       t('voiceActionsLabel'),
      ),
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox',
        checked: draft ? draft.structuredPromptVoice !== false : true,
        disabled: !writable,
        onChange: (e) => setTop('structuredPromptVoice', e.target.checked),
       }),
       t('structuredPromptVoice'),
      ),
     ),
    ),
    // Dictation Modes & Prompts (#264)
    h(DictationModesSection, {
     t: t,
     draft: draft,
     setTop: setTop,
     writable: writable,
    }),
    // Voice Action Macros (#167)
    h(MacrosSection, {
     t: t,
     draft: draft,
     setTop: setTop,
     writable: writable,
    }),
    h(JargonEditor, {
     t: t,
     draft: draft,
     setTop: setTop,
     writable: writable,
     jargonInput: jargonInput,
     setJargonInput: setJargonInput,
    }),
    h(ProviderDashboard, {
     t: t,
     statsData: statsData,
     recentDiagnostics: recentDiagnostics,
     onRefresh: fetchStatus,
    }),
    h(UpdaterCard, {
     t: t,
     updaterStatus: updaterStatus,
     updaterLoading: updaterLoading,
     updating: updating,
     updaterMsg: updaterMsg,
     updaterMsgKind: updaterMsgKind,
     onCheck: checkUpdater,
     onUpdateNow: onUpdateNow,
    }),
    h('div', { className: 'cb-row' },
     h('button', { type: 'button', className: 'cb-btn cb-btn-primary', disabled: !writable, onClick: save }, t('save')),
     saved ? h('span', { className: 'dvs-ok' }, t('saved')) : null,
     err ? h('span', { className: 'dvs-bad' }, err) : null,
    ),
   )
  }
  // ------------------------------------------------------- first-run wizard (#265)
  function FirstRunWizard(props) {
   const t = props.t || moduleT
   const draft = props.draft
   const setTop = props.setTop
   const writable = props.writable
   const onClose = props.onClose

   const isSecure = typeof window !== 'undefined' ? (window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') : true
   const hasMediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'
   const hasMediaRecorder = typeof MediaRecorder !== 'undefined'

   const [micPermission, setMicPermission] = React.useState('prompt')
   const [devices, setDevices] = React.useState([])
   const [selectedDev, setSelectedDev] = React.useState((draft && draft.micDeviceId) || '')
   const [signalTesting, setSignalTesting] = React.useState(false)
   const [currentRms, setCurrentRms] = React.useState(0)
   const [peakRms, setPeakRms] = React.useState(0)
   const [testingStt, setTestingStt] = React.useState(false)
   const [testCountdown, setTestCountdown] = React.useState(0)
   const [testResult, setTestResult] = React.useState(null)
   const [testError, setTestError] = React.useState('')
   const [testLatency, setTestLatency] = React.useState(null)

   const signalStreamRef = React.useRef(null)
   const audioCtxRef = React.useRef(null)
   const animFrameRef = React.useRef(null)

   React.useEffect(() => {
  if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
   navigator.permissions.query({ name: 'microphone' })
   .then((p) => {
    if (p) {
    setMicPermission(p.state)
    p.onchange = () => setMicPermission(p.state)
    }
   })
   .catch(() => {})
  }
   }, [])

   const refreshDevices = () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return
  navigator.mediaDevices.enumerateDevices()
   .then((list) => {
   const audioInputs = list.filter((d) => d.kind === 'audioinput')
   setDevices(audioInputs)
   })
   .catch(() => {})
   }

   React.useEffect(() => {
  refreshDevices()
   }, [])

   const stopSignalTest = () => {
  if (animFrameRef.current) {
   cancelAnimationFrame(animFrameRef.current)
   animFrameRef.current = null
  }
  if (signalStreamRef.current) {
   try { signalStreamRef.current.getTracks().forEach((trk) => trk.stop()) } catch (_) {}
   signalStreamRef.current = null
  }
  if (audioCtxRef.current) {
   try { audioCtxRef.current.close() } catch (_) {}
   audioCtxRef.current = null
  }
  setSignalTesting(false)
  setCurrentRms(0)
   }

   React.useEffect(() => {
  return () => {
   stopSignalTest()
  }
   }, [])

   const requestPermissionAndTestSignal = async () => {
  stopSignalTest()
  setTestError('')
  try {
   const constraints = {
   audio: selectedDev ? { deviceId: { exact: selectedDev } } : true,
   }
   const stream = await navigator.mediaDevices.getUserMedia(constraints)
   signalStreamRef.current = stream
   setMicPermission('granted')
   refreshDevices()

   const AC = typeof AudioContext !== 'undefined' ? AudioContext
   : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null)
   if (!AC) return
   const actx = new AC()
   audioCtxRef.current = actx
   if (actx.state === 'suspended') { actx.resume().catch(() => {}) }
   const src = actx.createMediaStreamSource(stream)
   const analyser = actx.createAnalyser()
   analyser.fftSize = 128
   src.connect(analyser)

   setSignalTesting(true)
   const buf = new Uint8Array(analyser.frequencyBinCount)

   const checkLevel = () => {
   if (!signalStreamRef.current) return
   analyser.getByteFrequencyData(buf)
   let sum = 0
   for (let i = 0; i < buf.length; i++) sum += buf[i]
   const rms = Math.min(100, Math.round((sum / buf.length / 255) * 100 * 2.2))
   setCurrentRms(rms)
   setPeakRms((prev) => Math.max(prev, rms))
   animFrameRef.current = requestAnimationFrame(checkLevel)
   }
   animFrameRef.current = requestAnimationFrame(checkLevel)
  } catch (err) {
   setMicPermission('denied')
   setTestError(String(err && err.message ? err.message : err))
   stopSignalTest()
  }
   }

   const runSttTest = async () => {
  stopSignalTest()
  setTestError('')
  setTestResult(null)
  setTestLatency(null)
  setTestingStt(true)
  setTestCountdown(3)

  let testStream = null
  let recorder = null
  const chunks = []

  try {
   const constraints = {
   audio: selectedDev ? { deviceId: { exact: selectedDev } } : true,
   }
   testStream = await navigator.mediaDevices.getUserMedia(constraints)
   let mime = 'audio/webm;codecs=opus'
   if (!MediaRecorder.isTypeSupported(mime)) mime = ''
   recorder = mime ? new MediaRecorder(testStream, { mimeType: mime }) : new MediaRecorder(testStream)
   recorder.ondataavailable = (e) => {
   if (e.data && e.data.size > 0) chunks.push(e.data)
   }
   recorder.start()

   let left = 3
   const countdownTimer = setInterval(() => {
   left -= 1
   setTestCountdown(left)
   if (left <= 0) {
    clearInterval(countdownTimer)
    if (recorder.state !== 'inactive') recorder.stop()
   }
   }, 1000)

   await new Promise((resolve) => recorder.addEventListener('stop', resolve, { once: true }))

   try { testStream.getTracks().forEach((trk) => trk.stop()) } catch (_) {}

   const blob = new Blob(chunks, { type: mime || 'audio/webm' })
   if (blob.size < 400) {
   setTestError(t('wizardTestEmpty'))
   setTestingStt(false)
   return
   }

   setTestCountdown(0)
   const startMs = Date.now()
   const dataBase64 = await blobToBase64(blob)
   const payload = {
   dataBase64,
   mimeType: mime || recorder.mimeType || 'audio/webm',
   mode: 'dictation',
   subMode: 'clean',
   }

   const res = await fetch('/dsh-voice/transcribe', {
   method: 'POST',
   headers: { 'content-type': 'application/json' },
   body: JSON.stringify(payload),
   })
   const data = await res.json()
   const latency = Date.now() - startMs
   setTestLatency(latency)

   if (!res.ok || !data || !data.ok) {
   const msg = (data && data.error && data.error.message) || `HTTP ${res.status}`
   setTestError(msg)
   } else {
   const recognized = String(data.text || '').trim()
   if (recognized) {
    setTestResult(recognized)
    if (typeof setTop === 'function') {
    setTop('wizardCompleted', true)
    }
   } else {
    setTestError(t('wizardTestEmpty'))
   }
   }
  } catch (err) {
   setTestError(String(err && err.message ? err.message : err))
  } finally {
   if (testStream) {
   try { testStream.getTracks().forEach((trk) => trk.stop()) } catch (_) {}
   }
   setTestingStt(false)
  }
   }

   // Determine active chain info
   const dictationChain = (draft && draft.dictation && draft.dictation.chain) || []
   const activeProvider = (dictationChain[0] && (dictationChain[0].provider || dictationChain[0])) || 'sensevoice'
   let areaLabel = t('wizardAreaServer')
   if (activeProvider === 'browser' || activeProvider === 'browser-webgpu') {
  areaLabel = t('wizardAreaBrowser')
   } else if (activeProvider !== 'sensevoice' && activeProvider !== 'local-whisper') {
  areaLabel = t('wizardAreaCloud')
   }

   let nextStepHint = ''
   if (!isSecure) {
  nextStepHint = t('wizardHintHttps')
   } else if (micPermission === 'denied') {
  nextStepHint = t('wizardHintPermission')
   } else if (peakRms === 0 && signalTesting) {
  nextStepHint = t('wizardHintDevice')
   } else if (testError) {
  nextStepHint = t('wizardHintProvider')
   }

   return h('div', { className: 'cb-section-card', style: { borderColor: 'var(--dsw-alias-state-brand-primary)' } },
  h('div', { className: 'cb-section-title' },
   h('span', null, '✨ ' + t('wizardTitle')),
   h('div', { style: { display: 'flex', gap: '8px' } },
   testResult ? h('span', { className: 'cb-badge cb-badge-ok' }, '✓ ' + t('wizardStatusCompleted')) : null,
   onClose ? h('button', {
    type: 'button', className: 'cb-btn cb-btn-mini', onClick: onClose, title: t('wizardClose'),
   }, '✕') : null,
   ),
  ),
  h('div', { className: 'cb-section-desc' }, t('wizardDesc')),

  // Step 1: Environment & Permissions
  h('div', { className: 'dvs-card' },
   h('div', { className: 'dvs-h' }, t('wizardStep1')),
   h('div', { className: 'cb-row' },
   h('span', { className: 'cb-badge ' + (isSecure ? 'cb-badge-ok' : 'cb-badge-err') },
    isSecure ? ('✓ ' + t('wizardSecureContextOk')) : ('✗ ' + t('wizardSecureContextBad'))
   ),
   h('span', { className: 'cb-badge ' + (hasMediaDevices ? 'cb-badge-ok' : 'cb-badge-err') },
    hasMediaDevices ? ('✓ ' + t('wizardMediaDevicesOk')) : ('✗ ' + t('wizardMediaDevicesBad'))
   ),
   h('span', { className: 'cb-badge ' + (hasMediaRecorder ? 'cb-badge-ok' : 'cb-badge-err') },
    hasMediaRecorder ? ('✓ ' + t('wizardMediaRecorderOk')) : ('✗ ' + t('wizardMediaRecorderBad'))
   ),
   h('span', { className: 'cb-badge ' + (micPermission === 'granted' ? 'cb-badge-ok' : (micPermission === 'denied' ? 'cb-badge-err' : 'cb-badge-warn')) },
    micPermission === 'granted' ? ('✓ ' + t('wizardMicPermissionOk')) : (micPermission === 'denied' ? ('✗ ' + t('wizardMicPermissionBad')) : ('· ' + t('wizardMicPermissionPrompt')))
   ),
   ),
   h('div', { className: 'cb-field', style: { marginTop: '8px' } },
   h('label', null, t('wizardMicLabel')),
   h('div', { className: 'cb-row' },
    h('select', {
    value: selectedDev,
    style: { flex: 1, minWidth: '240px' },
    onChange: (e) => {
     setSelectedDev(e.target.value)
     if (typeof setTop === 'function') setTop('micDeviceId', e.target.value)
     stopSignalTest()
    },
    },
    h('option', { value: '' }, 'Default System Microphone'),
    devices.map((d) => h('option', { key: d.deviceId, value: d.deviceId }, d.label || `Microphone ${d.deviceId.slice(0, 8)}…`))
    ),
    h('button', {
    type: 'button',
    className: 'cb-btn',
    onClick: requestPermissionAndTestSignal,
    }, t('wizardRequestMic')),
   ),
   ),
  ),

  // Step 2: Live Audio Signal Test
  h('div', { className: 'dvs-card' },
   h('div', { className: 'dvs-h' }, t('wizardStep2')),
   h('div', { className: 'cb-row', style: { alignItems: 'center' } },
   h('button', {
    type: 'button',
    className: 'cb-btn ' + (signalTesting ? 'cb-btn-danger' : 'cb-btn-primary'),
    onClick: signalTesting ? stopSignalTest : requestPermissionAndTestSignal,
   }, signalTesting ? t('wizardStopSignalCheck') : t('wizardStartSignalCheck')),
   signalTesting ? h('span', { className: 'dvs-sub' }, t('wizardSignalTesting')) : null,
   ),
   signalTesting ? h('div', { style: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' } },
   h('div', {
    style: {
    height: '14px',
    borderRadius: '7px',
    background: 'var(--dsw-alias-bg-layer-1)',
    border: '1px solid var(--dsw-alias-border-l1)',
    overflow: 'hidden',
    position: 'relative',
    },
   },
    h('div', {
    style: {
     width: `${currentRms}%`,
     height: '100%',
     background: currentRms > 5 ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-dimmed)',
     transition: 'width 0.05s linear',
    },
    }),
   ),
   h('span', { className: currentRms > 5 ? 'dvs-ok' : 'dvs-sub' },
    currentRms > 5
    ? t('wizardSignalOk').replace('{level}', currentRms)
    : t('wizardSignalZero')
   ),
   ) : null,
  ),

  // Step 3: Transcription Round-Trip Test
  h('div', { className: 'dvs-card' },
   h('div', { className: 'dvs-h' }, t('wizardStep3')),
   h('div', { className: 'cb-row' },
   h('span', { className: 'dvs-sub' }, `${t('wizardProviderLabel')} ${activeProvider}`),
   h('span', { className: 'cb-badge' }, `${t('wizardProcessingArea')} ${areaLabel}`),
   ),
   h('div', { className: 'cb-row', style: { marginTop: '8px' } },
   h('button', {
    type: 'button',
    className: 'cb-btn cb-btn-primary',
    disabled: testingStt || micPermission === 'denied',
    onClick: runSttTest,
   }, testingStt
    ? (testCountdown > 0 ? t('wizardRecordingTest').replace('{left}', testCountdown) : t('wizardTranscribingTest'))
    : t('wizardStartTestRecord')
   ),
   ),
   testResult ? h('div', { style: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' } },
   h('div', { className: 'dvs-ok' },
    '✓ ' + t('wizardTestSuccess').replace('{latency}', testLatency || 0)
   ),
   h('blockquote', {
    style: {
    margin: '4px 0 0 0',
    padding: '8px 12px',
    borderRadius: '6px',
    background: 'var(--dsw-alias-bg-layer-3)',
    borderLeft: '4px solid var(--dsw-alias-state-success-primary)',
    color: 'var(--dsw-alias-label-primary)',
    fontStyle: 'italic',
    },
   }, `“${testResult}”`),
   ) : null,
   testError ? h('div', { className: 'cb-alert-err', style: { marginTop: '8px' } },
   t('wizardTestFailed').replace('{error}', testError)
   ) : null,
  ),

  // Next Step Hint / Feedback
  nextStepHint ? h('div', { className: 'dvs-wait', style: { fontStyle: 'italic' } },
   t('wizardNextStepHint').replace('{hint}', nextStepHint)
  ) : null,

  // Wizard Bottom Actions
  h('div', { className: 'cb-row', style: { justifyContent: 'space-between', marginTop: '6px' } },
   h('button', {
   type: 'button',
   className: 'cb-btn',
   onClick: () => {
    if (typeof setTop === 'function') setTop('wizardCompleted', true)
    if (onClose) onClose()
   },
   }, t('wizardSkip')),
   testResult ? h('button', {
   type: 'button',
   className: 'cb-btn cb-btn-primary',
   onClick: () => {
    if (typeof setTop === 'function') setTop('wizardCompleted', true)
    if (onClose) onClose()
   },
   }, '✓ ' + t('wizardFinishSuccess')) : null,
  ),
   )
  }
    // Card in Settings → Plugins → Plugin settings (#18)
    function PluginCard(props) {
      const page = !!(props && props.view === 'page')
      const [open, setOpen] = React.useState(!!page)
      const tt = (props && props.t) || t
      const title = tt('title')
      // Row seat (plugins.row.config): the host page draws title/icon/crumb and the
      // padding, so the summary is a one-liner and the page drops our card chrome.
      if (props && props.view === 'summary') {
        return h('span', { className: 'dvo-pdesc' }, tt('cardHint'))
      }
      return h(ErrorBoundary, null,
        h(page ? 'div' : 'li',
          { className: page ? 'dvo-ppage' : (open ? 'dvo-pcard dvo-pcardOpen' : 'dvo-pcard') },
          h('button',
            {
              type: 'button', className: 'dvo-phead',
              style: page ? { display: 'none' } : undefined,
              'aria-expanded': page ? 'true' : (open ? 'true' : 'false'),
              'aria-label': (open ? tt('collapse') : tt('expand')) + ': ' + title,
              onClick: () => setOpen((v) => !v),
            },
            h('span', { className: 'dvo-pheadtext' },
              h('span', { className: 'dvo-ptitle' }, title),
              h('span', { className: 'dvo-pdesc' }, tt('cardHint')),
            ),
            h('span', { className: 'dvo-pchev' }, chevronIcon()),
          ),
          (page || open) ? h('div', { className: 'dvo-pbody dvo-settings-root' }, h(VoiceSection, props)) : null,
        ),
      )
    }

    function registerSettings(ctx) {
      ctx.effect(() => {
        const offCss = installSettingsCss()
        const offItem = ctx.slots.inject('plugins.item', () => ctx.slots.register(
          {
            name: 'plugins.item',
            id: ROW_ID,
            order: 60,
            label: () => t('voiceInput'),
            locale: NS,
            inject: () => ({ ctx: ctx }),
          },
          PluginCard,
        ))
        const offRow = ctx.slots.inject('plugins.row.config', () => ctx.slots.register(
          {
            name: 'plugins.row.config',
            key: ROW_CONFIG_KEY,
            locale: NS,
            inject: () => ({ ctx: ctx }),
          },
          PluginCard,
        ))
        const offLegacy = ctx.slots.inject('settings.plugin.item', () => ctx.slots.register(
          {
            name: 'settings.plugin.item',
            key: NS,
            locale: NS,
            inject: () => ({ ctx: ctx }),
          },
          PluginCard,
        ))
        return () => {
          if (typeof offCss === 'function') offCss()
          if (typeof offItem === 'function') offItem()
          if (typeof offRow === 'function') offRow()
          if (typeof offLegacy === 'function') offLegacy()
        }
      }, 'dsh-voice: settings card slots')
    }

    exports.inject = ['timer', 'slots', 'configForms', 'locale']
    exports.apply = function apply(ctx) {
      // English is the source and fallback language; Chinese is the built-in
      // localized user dictionary. Other languages (like Russian) come from
      // the separate translation plugin at runtime.
      const addLocale = (locale, dictionary) => {
        try {
          return ctx.locale.register(NS, locale, dictionary)
        } catch (alreadyTaken) {
          return () => {}
        }
      }
      ctx.effect(() => {
        const undo = [addLocale('en', en), addLocale('zh', zh)]
        return () => { for (const off of undo) off() }
      }, 'dsh-voice: locale dictionaries')
      ctx.effect(() => {
        return registerGlobalLifecycle()
      }, 'dsh-voice: global lifecycle')
      moduleT = ctx.locale.bind(NS)
      registerComposer(ctx)
      registerSettings(ctx)
    }
    exports._test = {
      voice,
      keyLabel,
      keyFromEvent,
      hotkeyMatches,
      isAllowedInEditable,
      isHotkeyRelease,
      extractContextKeywords,
      DICTATION_MODES,
      getDictationModeLabel,
      cycleDictationMode,
      resolveBrowserRecognitionLang,
      VoiceSection,
      cutPhrase,
      sendAudio,
      modeChain,
      openMic,
      startRecording,
      cancelCurrent,
      stopCurrent,
      submitPending,
      cancelPending,
      keepPending,
      initPendingPreview,
      cancelPendingPreview,
      keepPendingPreview,
      submitPendingPreview,
      renderEditablePreviewPill,
      editIcon,
      sendIcon,
      loadWebGpuWhisper,
      isWebGpuSupported,
      isWasmSupported,
      isOfflineSupported,
      waitStop,
      currentLevel,
      accentColor,
      softColor,
    }
    return module.exports
  },
})
