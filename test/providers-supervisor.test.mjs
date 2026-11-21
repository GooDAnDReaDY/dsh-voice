import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SpeechToTextProvider,
  DeepgramProvider,
  GroqProvider,
  HuggingFaceProvider,
  LocalWhisperProvider,
  SenseVoiceProvider,
  OpenAICompatibleProvider,
  ProviderRegistry,
  createDefaultProviderRegistry,
} from '../lib/provider-registry.js'
import { ProcessSupervisor, DAEMON_STATES } from '../lib/supervisor.js'

test('Issue #306: SpeechToTextProvider strategy contract, validation, healthcheck, and custom registration', async () => {
  const registry = createDefaultProviderRegistry({
    openai: {
      template: 'openai-transcriptions',
      baseURL: 'https://api.openai.com/v1',
      model: 'whisper-1',
      keyEnv: 'OPENAI_API_KEY',
    },
  })

  assert.ok(registry.has('deepgram'))
  assert.ok(registry.has('groq'))
  assert.ok(registry.has('hf'))
  assert.ok(registry.has('local-whisper'))
  assert.ok(registry.has('sensevoice'))
  assert.ok(registry.has('openai'))

  const dg = registry.get('deepgram')
  assert.ok(dg instanceof DeepgramProvider)
  assert.deepEqual(dg.validateConfig({ deepgramKeyEnv: 'DEEPGRAM_API_KEY' }), { valid: true })
  assert.equal(dg.validateConfig({}).valid, false)

  const hcMissing = await dg.healthcheck({ resolveKey: async () => '', cfg: { deepgramKeyEnv: 'DEEPGRAM_API_KEY' } })
  assert.equal(hcMissing.ok, false)
  const hcReady = await dg.healthcheck({ resolveKey: async () => 'secret', cfg: { deepgramKeyEnv: 'DEEPGRAM_API_KEY' } })
  assert.equal(hcReady.ok, true)

  // Register custom strategy dynamically
  class MockStrategy extends SpeechToTextProvider {
    constructor() {
      super({ key: 'mock-engine', kind: 'custom', defaultModel: 'm1' })
    }
    async transcribe(_deps, req) {
      return { ok: true, provider: this.key, text: `transcribed:${req.effectivePrompt}` }
    }
  }
  registry.register(new MockStrategy())
  const runners = registry.buildRunners({ cfg: {} }, { vocabulary: ['alpha', 'beta'] })
  assert.equal(typeof runners['mock-engine'], 'function')
  assert.equal(runners['mock-engine'].name, 'mock-engine')
  const out = await runners['mock-engine']()
  assert.equal(out.ok, true)
  assert.equal(out.text, 'transcribed:alpha, beta')
})

test('Issue #310: ProcessSupervisor FSM transitions, crash tracking, heartbeat, and disposal', async () => {
  let alive = true
  const transitions = []
  const sup = new ProcessSupervisor({
    name: 'whisper',
    healthcheck: async () => alive,
    heartbeatMs: 40,
  })
  sup.onStateChange((e) => transitions.push(e.state))

  assert.equal(sup.state, DAEMON_STATES.STOPPED)
  assert.equal(sup.canTransition(DAEMON_STATES.STARTING), true)

  sup.transition(DAEMON_STATES.STARTING, 'spawning')
  assert.equal(sup.state, DAEMON_STATES.STARTING)

  let killed = false
  const listeners = {}
  const mockHandle = {
    on(evt, cb) { listeners[evt] = cb },
    kill() { killed = true },
  }
  sup.attachHandle(mockHandle)
  sup.transition(DAEMON_STATES.RUNNING, 'healthy')
  assert.equal(sup.state, DAEMON_STATES.RUNNING)

  // Simulate heartbeat degradation and recovery
  alive = false
  sup.startHeartbeat()
  await new Promise((r) => setTimeout(r, 95))
  assert.equal(sup.state, DAEMON_STATES.DEGRADED)

  alive = true
  await new Promise((r) => setTimeout(r, 95))
  assert.equal(sup.state, DAEMON_STATES.RUNNING)
  sup.stopHeartbeat()

  // Simulate unexpected process exit -> CRASHED
  listeners.exit(1, null)
  assert.equal(sup.state, DAEMON_STATES.CRASHED)
  assert.equal(sup.crashCount, 1)

  // Dispose kills handle and resets to STOPPED
  sup.dispose()
  assert.equal(killed, true)
  assert.equal(sup.state, DAEMON_STATES.STOPPED)
  assert.ok(transitions.includes(DAEMON_STATES.STARTING))
  assert.ok(transitions.includes(DAEMON_STATES.RUNNING))
  assert.ok(transitions.includes(DAEMON_STATES.DEGRADED))
  assert.ok(transitions.includes(DAEMON_STATES.CRASHED))
  assert.ok(transitions.includes(DAEMON_STATES.STOPPED))
})

test('Issue #347: ProviderRegistry.checkHealth evaluates validation and credential healthcheck', async () => {
  const registry = createDefaultProviderRegistry({
    openai: {
      template: 'openai-transcriptions',
      baseURL: 'https://api.openai.com/v1',
      model: 'whisper-1',
      keyEnv: 'OPENAI_API_KEY',
    },
  })

  // 1. Without credentials: cloud providers report ok: false with missing key reason
  const healthNoKey = await registry.checkHealth({
    resolveKey: async () => '',
    cfg: {
      groqKeyEnv: 'GROQ_API_KEY',
      deepgramKeyEnv: 'DEEPGRAM_API_KEY',
      whisperUrl: 'http://127.0.0.1:8001/inference',
    },
  }, { keys: ['groq', 'deepgram', 'local-whisper', 'openai'] })

  assert.equal(healthNoKey.groq.configured, true)
  assert.equal(healthNoKey.groq.hasKey, false)
  assert.equal(healthNoKey.groq.ok, false)
  assert.equal(healthNoKey.groq.reason, 'no GROQ_API_KEY')

  assert.equal(healthNoKey.deepgram.configured, true)
  assert.equal(healthNoKey.deepgram.hasKey, false)
  assert.equal(healthNoKey.deepgram.ok, false)

  assert.equal(healthNoKey['local-whisper'].configured, true)
  assert.equal(healthNoKey['local-whisper'].ok, true)

  assert.equal(healthNoKey.openai.configured, true)
  assert.equal(healthNoKey.openai.hasKey, false)
  assert.equal(healthNoKey.openai.ok, false)

  // 2. With credentials: cloud providers report ok: true
  const healthWithKey = await registry.checkHealth({
    resolveKey: async (ref) => (ref ? 'sk-secret' : ''),
    cfg: {
      groqKeyEnv: 'GROQ_API_KEY',
      deepgramKeyEnv: 'DEEPGRAM_API_KEY',
      whisperUrl: 'http://127.0.0.1:8001/inference',
    },
  }, { keys: ['groq', 'openai'] })

  assert.equal(healthWithKey.groq.configured, true)
  assert.equal(healthWithKey.groq.hasKey, true)
  assert.equal(healthWithKey.groq.ok, true)
  assert.equal(healthWithKey.groq.reason, null)

  assert.equal(healthWithKey.openai.configured, true)
  assert.equal(healthWithKey.openai.hasKey, true)
  assert.equal(healthWithKey.openai.ok, true)
})
