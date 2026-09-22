import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PROVIDER_KEYS,
  PRESET_KEYS,
  KNOWN_KEYS,
  DEFAULT_MODELS,
  CUSTOM_TEMPLATES,
  PRESET_PROVIDERS,
} from '../lib/providers.js'

test('provider constants and structures integrity', () => {
  assert.ok(PROVIDER_KEYS.includes('deepgram'))
  assert.ok(PROVIDER_KEYS.includes('groq'))
  assert.ok(PROVIDER_KEYS.includes('hf'))
  assert.ok(PROVIDER_KEYS.includes('local-whisper'))
  assert.ok(PROVIDER_KEYS.includes('sensevoice'))
  assert.ok(PROVIDER_KEYS.includes('browser'))

  assert.deepEqual(CUSTOM_TEMPLATES, ['openai-transcriptions', 'openai-chat-audio'])

  assert.ok(PRESET_KEYS.includes('openai'))
  assert.ok(PRESET_KEYS.includes('openrouter'))
  assert.ok(PRESET_KEYS.includes('siliconflow'))
  assert.ok(PRESET_KEYS.includes('deepinfra'))
  assert.ok(PRESET_KEYS.includes('fireworks'))
  assert.ok(PRESET_KEYS.includes('mistral'))

  assert.equal(KNOWN_KEYS.length, PROVIDER_KEYS.length + PRESET_KEYS.length)
  for (const k of PROVIDER_KEYS) {
    assert.ok(KNOWN_KEYS.includes(k), `KNOWN_KEYS includes ${k}`)
  }
  for (const k of PRESET_KEYS) {
    assert.ok(KNOWN_KEYS.includes(k), `KNOWN_KEYS includes ${k}`)
  }
})

test('default models are defined for built-in engines', () => {
  assert.equal(DEFAULT_MODELS.deepgram, 'nova-2')
  assert.equal(DEFAULT_MODELS.groq, 'whisper-large-v3-turbo')
  assert.equal(DEFAULT_MODELS.hf, 'openai/whisper-large-v3')
  assert.equal(DEFAULT_MODELS.sensevoice, 'SenseVoiceSmall')
  assert.equal(DEFAULT_MODELS['local-whisper'], '')
})

test('preset providers configuration validation', () => {
  for (const [key, conf] of Object.entries(PRESET_PROVIDERS)) {
    assert.ok(conf.baseURL, `${key} must have baseURL`)
    assert.ok(conf.model, `${key} must have model`)
    assert.ok(conf.keyEnv, `${key} must have keyEnv`)
    assert.ok(CUSTOM_TEMPLATES.includes(conf.template), `${key} must have valid template`)
  }
})
