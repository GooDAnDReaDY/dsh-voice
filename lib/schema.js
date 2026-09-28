// lib/schema.js — Schemastery configuration schemas for @goodandready/dsh-voice
import z from '@deepseek-ai/schemastery'
import { PROVIDER_KEYS, PRESET_KEYS, CUSTOM_TEMPLATES } from './providers.js'

export const ChainEntry = z.object({
  provider: z.string().default('local-whisper')
    .description(`Provider key. Built in: ${PROVIDER_KEYS.join(', ')}. `
      + `Ready-made, just add the key: ${PRESET_KEYS.join(', ')}. `
      + 'Or the name of an entry from customProviders. '
      + '"browser" recognises speech in the page itself — no key, no upload to this host, '
      + 'text appears while you speak; put a normal provider after it as a fallback.'),
  model: z.string().default('')
    .description('Model override. Empty means the provider default.'),
})

// Custom provider: everything needed to call any OpenAI-compatible API.
export const CustomProvider = z.object({
  key: z.string().default('')
    .description('Name used in the chains above. Must differ from the built-in keys.'),
  template: z.string().default('openai-transcriptions')
    .description(`API shape: ${CUSTOM_TEMPLATES.join(' or ')}. `
      + 'OpenRouter has no /audio/transcriptions, use openai-chat-audio there.'),
  baseURL: z.string().default('')
    .description('API root without a trailing slash, e.g. https://openrouter.ai/api/v1'),
  model: z.string().default(''),
  keyEnv: z.string().default('')
    .description('Credential name holding the API key. Empty means no authorization header.'),
  prompt: z.string().default('')
    .description('openai-chat-audio only: instruction sent along with the audio. '
      + 'Empty means the built-in one.'),
})


export const BaseConfig = z.object({
  dictation: z.object({
    chain: z.array(ChainEntry)
      .default([{ provider: 'deepgram', model: '' }, { provider: 'groq', model: '' }, { provider: 'local-whisper', model: '' }])
      .description('Fallback chain for dictation. Speed matters more than accuracy here.'),
    language: z.string().default('')
      .description('Recognition language code for dictation (e.g. "en", "ru", "zh", or empty string for auto-detection).'),
    vadSilenceMs: z.number().default(700)
      .description('Silence longer than this ends a phrase and sends the chunk.'),
    sendDelayMs: z.number().default(0)
      .description('Dictation: wait this many ms after a phrase before appending it, with a cancel window. 0 disables the delay.'),
    polish: z.boolean().default(false)
      .description('Polish the transcript through the harness model before inserting: punctuation, paragraphs, filler-word removal.'),
    stream: z.boolean().default(false)
      .description('Continuous dictation: cut phrases by a timer instead of waiting for a long silence, so text flows while you speak.'),
    streamChunkMs: z.number().default(1200)
      .description('Continuous dictation: phrase length in ms of uninterrupted speech before the chunk is sent.'),
    vadAdapt: z.number().min(0).max(1).default(0)
      .description('Adaptive silence threshold: 0 = fixed (current behaviour); >0 shrinks the threshold during dense speech and grows it during pauses.'),
  }).default({}),
  message: z.object({
    chain: z.array(ChainEntry)
      .default([{ provider: 'groq', model: '' }, { provider: 'hf', model: '' }, { provider: 'local-whisper', model: '' }])
      .description('Fallback chain for voice messages. Accuracy matters more than speed.'),
    language: z.string().default('')
      .description('Recognition language code for messages (e.g. "en", "ru", "zh", or empty string for auto-detection).'),
    autoSendMs: z.number().default(4000)
      .description('Cancel window before the recognized text is sent to the agent.'),
    sessionCommands: z.boolean().default(false)
      .description('Voice session commands: a clean "send", "cancel", "stop", "continue" does not become text — it drives the composer/session.'),
    polishSend: z.boolean().default(false)
      .description('Polish the whole composed draft through the model right before sending, not just single phrases.'),
  }).default({}),
  hotkey: z.string().default('Control')
    .description('Hold this key anywhere in the page to record a voice message; release to send, '
      + 'Escape to discard. Modifier names (Control, Alt, Shift) or a KeyboardEvent code. '
      + 'Empty disables the hotkey.'),
  customProviders: z.array(CustomProvider).default([])
    .description('Own recognition providers, usable in both chains next to the built-in ones.'),
  deepgramKeyEnv: z.string().default('DEEPGRAM_API_KEY'),
  deepgramBaseUrl: z.string().default('https://api.deepgram.com')
    .description('Deepgram-compatible host. Point this at a private/self-hosted Deepgram deployment '
      + 'instead of the public api.deepgram.com endpoint.'),
  groqKeyEnv: z.string().default('GROQ_API_KEY'),
  hfTokenEnv: z.string().default('HF_TOKEN'),
  whisperUrl: z.string().default('http://127.0.0.1:8001/inference'),
  whisperBin: z.string().default('whisper-server')
    .description('whisper.cpp server binary, looked up in PATH unless an absolute path is given.'),
  whisperModel: z.string().default('')
    .description('Absolute path to the ggml model. Autostart stays off while this is empty; '
      + 'point it at your own model file to let the plugin launch whisper.cpp itself.'),
  autoStart: z.boolean().default(true)
    .description('Launch the local whisper.cpp server on activation if the port is free. '
      + 'Requires whisperModel to be set.'),
  ffmpegBin: z.string().default('ffmpeg')
    .description('ffmpeg used to convert browser webm/opus into the WAV that whisper.cpp requires.'),
  timeoutMs: z.number().default(120000),
  allowedAudioDirs: z.array(z.string()).default([]),
  maxFileBytes: z.number().default(25 * 1024 * 1024),
  normalizeTranscript: z.boolean().default(false)
    .description('transcribe_audio: convert spoken numbers to digits and tidy punctuation.'),
  beep: z.boolean().default(false)
    .description('Play a short beep when recording starts and stops.'),
  localOnly: z.boolean().default(false)
    .description('Restrict both chains to local-whisper only: fully offline, no cloud providers.'),
  micDeviceId: z.string().default('')
    .description('Microphone device id for recording. Empty means the system default.'),
  noiseGateDb: z.number().default(-45)
    .description('Audio noise gate threshold in dB for client-side recording (-50 to -25 dB, or <= -90 to disable). Silence below this threshold cuts ambient background noise and prevents false VAD triggers.'),
  historyLimit: z.number().default(20)
    .description('How many recent dictation inserts to keep for undo in the browser. 0 disables history.'),
  vocabulary: z.array(z.string()).default([])
    .description('Custom words (names, terms) hinted to providers so they recognize them correctly.'),
  contextGlossary: z.boolean().default(true)
    .description('Automatically extract code words and terms from context and hint them to STT providers.'),
  noiseSuppression: z.boolean().default(true)
    .description('Enable hardware noise suppression, echo cancellation, and auto gain control.'),
  voiceCommands: z.boolean().default(false)
    .description('During dictation, spoken edit commands ("new line", "paragraph") become real line breaks instead of words.'),
  wakeWord: z.string().default('')
    .description('Heads-free dictation: a phrase that, when recognized by the browser leg, starts a recording. Empty disables.'),
  bargeIn: z.boolean().default(false)
    .description('Ongoing playback or a long turn is interrupted by detected speech (browser leg).'),
  polishBaseUrl: z.string().default('')
    .description('Offline polish: OpenAI-compatible /chat/completions endpoint (e.g. local Ollama). Empty uses the harness model.'),
  polishModel: z.string().default('')
    .description('Offline polish: model id on polishBaseUrl.'),
  polishKeyEnv: z.string().default('')
    .description('Offline polish: credential name for the api key. Empty means no Authorization header.'),
  polishProvider: z.string().default('')
    .description('Harness polish: provider id. Empty uses the agent default model selection.'),
  polishModelId: z.string().default('')
    .description('Harness polish: model id. Empty uses the agent default model selection.'),
  sensevoiceUrl: z.string().default('http://127.0.0.1:6006/api/v1/asr')
    .description('SenseVoice-ONNX / Sherpa-ONNX endpoint: POST /api/v1/asr or OpenAI-compatible /v1/audio/transcriptions.'),
  sensevoiceBin: z.string().default('sherpa-onnx-offline-http-server')
    .description('SenseVoice / sherpa-onnx executable binary used when autostart is enabled.'),
  sensevoiceModel: z.string().default('')
    .description('SenseVoice / sherpa-onnx model path or model identifier.'),
  sensevoiceAutostart: z.boolean().default(false)
    .description('Start the local SenseVoice / sherpa-onnx server process automatically on startup.'),
  visualizerStyle: z.union(['liquid-wave', 'dynamic-orb', 'bars', 'off']).default('liquid-wave')
    .description('Audio visualizer animation style in the recording pill: "liquid-wave", "dynamic-orb", "bars", or "off".'),
  gatedTurnTaking: z.boolean().default(true)
    .description('Gated mode for speakers: pause recording or ignore input while assistant TTS is speaking to prevent acoustic feedback.'),
  autoSendVisualRing: z.boolean().default(true)
    .description('Show animated circular countdown ring on recording pill before auto-sending.'),
  voiceActions: z.boolean().default(true)
    .description('Enable spoken action triggers ("send", "cancel", "clear", "new line" in English/Russian).'),
  techJargonCorrection: z.boolean().default(true)
    .description('Apply developer lexicon and IT jargon normalization (GitHub, Docker, pnpm, Kubernetes, etc.).'),
  jargonDictionary: z.array(z.object({ from: z.string(), to: z.string() })).default([])
    .description('Custom jargon replacement dictionary.'),
  liveInterimPreview: z.boolean().default(true)
    .description('Display real-time interim speech preview (ghost text) in the recording pill.'),
  structuredPromptVoice: z.boolean().default(true)
    .description('Target voice dictation and numeric choices to active DSH structured prompt modals.'),
})


