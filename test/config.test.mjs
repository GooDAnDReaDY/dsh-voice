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

import { createConfigReader } from '../lib/config-compat.js'
import { readFileSync } from 'node:fs'

test('Config schema has volatile support in lib/index.js', () => {
  const indexSrc = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
  assert.match(indexSrc, /function makeVolatile\(schema\)/, 'makeVolatile helper must exist')
  assert.match(indexSrc, /export const Config = typeof z\.number\(\)\.volatile === 'function'/, 'Config must conditionally export volatile schema')
  assert.match(indexSrc, /createConfigReader\(baseConfig, ctx\)/, 'apply() must use createConfigReader')
})

test('createConfigReader decodes volatile nodes and caches unwrapped results', () => {
  const events = []
  const mockCtx = {
    on(event, handler) {
      events.push({ event, handler })
    }
  }

  const rawConfig = {
    hotkey: { get: () => 'Alt' },
    dictation: {
      language: { get: () => 'ru' },
      vadSilenceMs: 800,
    },
    plainField: 'normal',
  }

  const reader = createConfigReader(rawConfig, mockCtx)
  const cfg1 = reader()

  assert.equal(cfg1.hotkey, 'Alt')
  assert.equal(cfg1.dictation.language, 'ru')
  assert.equal(cfg1.dictation.vadSilenceMs, 800)
  assert.equal(cfg1.plainField, 'normal')

  // Identity is stable across calls when not invalidated
  const cfg2 = reader()
  assert.equal(cfg1, cfg2)

  // Invalidate on event
  assert.ok(events.length >= 3, 'Registered event listeners')
  const updateListener = events.find(e => e.event === 'loader/volatile-update')
  assert.ok(updateListener, 'loader/volatile-update listener registered')

  // Mutate underlying volatile getter
  rawConfig.hotkey.get = () => 'Control'
  updateListener.handler()

  const cfg3 = reader()
  assert.equal(cfg3.hotkey, 'Control')
  assert.equal(cfg3.dictation.language, 'ru')
})
