// Speech recognition providers: built-ins plus custom ones from settings (#306).
// Uses Strategy pattern and ProviderRegistry in lib/provider-registry.js.

import { readErrorDetail, readHttpError, safeJson, isAutoLang, fileName, chatAudioFormat } from './provider-http.js'
import {
  SpeechToTextProvider,
  BrowserStubProvider,
  DeepgramProvider,
  GroqProvider,
  HuggingFaceProvider,
  LocalWhisperProvider,
  SenseVoiceProvider,
  OpenAICompatibleProvider,
  ProviderRegistry,
  createDefaultProviderRegistry,
} from './provider-registry.js'

export {
  readErrorDetail,
  readHttpError,
  safeJson,
  isAutoLang,
  fileName,
  chatAudioFormat,
  SpeechToTextProvider,
  BrowserStubProvider,
  DeepgramProvider,
  GroqProvider,
  HuggingFaceProvider,
  LocalWhisperProvider,
  SenseVoiceProvider,
  OpenAICompatibleProvider,
  ProviderRegistry,
  createDefaultProviderRegistry,
}

export const PROVIDER_KEYS = ['browser', 'browser-webgpu', 'deepgram', 'groq', 'hf', 'local-whisper', 'sensevoice']
export const CUSTOM_TEMPLATES = ['openai-transcriptions', 'openai-chat-audio']

export const PRESET_PROVIDERS = {
  openai: {
    template: 'openai-transcriptions',
    baseURL: 'https://api.openai.com/v1',
    model: 'whisper-1',
    keyEnv: 'OPENAI_API_KEY',
  },
  siliconflow: {
    template: 'openai-transcriptions',
    baseURL: 'https://api.siliconflow.cn/v1',
    model: 'FunAudioLLM/SenseVoiceSmall',
    keyEnv: 'SILICONFLOW_API_KEY',
  },
  deepinfra: {
    template: 'openai-transcriptions',
    baseURL: 'https://api.deepinfra.com/v1/openai',
    model: 'openai/whisper-large-v3-turbo',
    keyEnv: 'DEEPINFRA_API_KEY',
  },
  fireworks: {
    template: 'openai-transcriptions',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    model: 'whisper-v3-turbo',
    keyEnv: 'FIREWORKS_API_KEY',
  },
  mistral: {
    template: 'openai-transcriptions',
    baseURL: 'https://api.mistral.ai/v1',
    model: 'voxtral-mini-latest',
    keyEnv: 'MISTRAL_API_KEY',
  },
  openrouter: {
    template: 'openai-chat-audio',
    baseURL: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-2.5-flash',
    keyEnv: 'OPENROUTER_API_KEY',
  },
}

export const PRESET_KEYS = Object.keys(PRESET_PROVIDERS)
export const KNOWN_KEYS = PROVIDER_KEYS.concat(PRESET_KEYS)

export const DEFAULT_MODELS = {
  deepgram: 'nova-2',
  groq: 'whisper-large-v3-turbo',
  hf: 'openai/whisper-large-v3',
  'local-whisper': '',
  sensevoice: 'SenseVoiceSmall',
}

export const defaultProviderRegistry = createDefaultProviderRegistry(PRESET_PROVIDERS)

export function makeProviders(deps, req) {
  return defaultProviderRegistry.buildRunners(deps, req)
}
