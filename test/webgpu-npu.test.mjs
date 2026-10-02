import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PROVIDER_KEYS, makeProviders } from '../lib/providers.js'
import { buildProviderOrder } from '../lib/transcribe-core.js'
import { buildSensevoiceArgs } from '../lib/sensevoice-installer.js'
import { runChain } from '../lib/chain.js'
import { ChainEntry, BaseConfig } from '../lib/schema.js'

test('lib/providers.js includes browser-webgpu in PROVIDER_KEYS', () => {
  assert.ok(PROVIDER_KEYS.includes('browser-webgpu'), 'PROVIDER_KEYS must include browser-webgpu')
  assert.equal(PROVIDER_KEYS[1], 'browser-webgpu')
})

test('lib/schema.js validates ChainEntry with browser-webgpu', () => {
  const parsed = ChainEntry({ provider: 'browser-webgpu', model: 'onnx-community/whisper-tiny' })
  assert.equal(parsed.provider, 'browser-webgpu')
  assert.equal(parsed.model, 'onnx-community/whisper-tiny')
})

test('lib/schema.js defines sensevoiceProvider and sensevoiceThreads defaults', () => {
  const cfg = BaseConfig({})
  assert.equal(cfg.sensevoiceProvider, 'cpu')
  assert.equal(cfg.sensevoiceThreads, 4)
  assert.equal(cfg.webgpuModel, 'onnx-community/whisper-tiny')
})

test('lib/transcribe-core.js keeps browser-webgpu under localOnly mode', () => {
  const chain = [
    { provider: 'browser-webgpu' },
    { provider: 'groq' },
    { provider: 'local-whisper' },
  ]
  const { order } = buildProviderOrder({
    localOnly: true,
    chain,
    customKeys: [],
    knownKeys: PROVIDER_KEYS,
    defaultModels: {},
  })
  assert.deepEqual(order, ['browser-webgpu', 'local-whisper'], 'localOnly must keep browser-webgpu and local-whisper, dropping groq')
})

test('buildSensevoiceArgs supports Rockchip RK3588 NPU (rknpu) and thread count', () => {
  const cfg = {
    sensevoiceModel: '/opt/models/sensevoice/model.int8.onnx',
    sensevoiceProvider: 'rknpu',
    sensevoiceThreads: 8,
  }
  const args = buildSensevoiceArgs(cfg, '6006')
  assert.ok(args.includes('--provider=rknpu'), 'must include --provider=rknpu')
  assert.ok(args.includes('--num-threads=8'), 'must include --num-threads=8')
  assert.ok(args.includes('--port=6006'), 'must include port')
  assert.ok(args.includes('--sense-voice-model='), 'must include model path')
})

test('buildSensevoiceArgs default cpu provider omits provider flag for standard CPU', () => {
  const cfg = {
    sensevoiceModel: '/opt/models/sensevoice/model.int8.onnx',
    sensevoiceProvider: 'cpu',
    sensevoiceThreads: 4,
  }
  const args = buildSensevoiceArgs(cfg, '6006')
  assert.ok(!args.includes('--provider='), 'default cpu should not pass --provider=cpu flag')
  assert.ok(args.includes('--num-threads=4'))
})

test('makeProviders returns non-throwing browser-webgpu stub on host', async () => {
  const providers = makeProviders({
    resolveKey: () => null,
    fetchImpl: () => Promise.reject(new Error('no network')),
    cfg: {},
    toWav: () => Buffer.from([]),
  }, {
    bytes: Buffer.from([]),
    mime: 'audio/webm',
    lang: 'en',
    signal: null,
    models: {},
    vocabulary: [],
  })

  assert.equal(typeof providers['browser-webgpu'], 'function')
  const res = await providers['browser-webgpu']()
  assert.equal(res.ok, false)
  assert.equal(res.provider, 'browser-webgpu')
  assert.ok(res.reason.includes('recognition runs in the page'))
})

test('runChain gracefully falls back from browser-webgpu to next host provider', async () => {
  const attempts = []
  const providers = {
    'browser-webgpu': async () => ({
      ok: false,
      provider: 'browser-webgpu',
      reason: 'browser-webgpu: host fallback',
    }),
    'local-whisper': async () => ({
      ok: true,
      provider: 'local-whisper',
      text: 'offline fallback succeeded',
    }),
  }

  const result = await runChain(['browser-webgpu', 'local-whisper'], providers, (p, info) => {
    attempts.push({ p, ok: info.ok })
  })

  assert.equal(result.provider, 'local-whisper')
  assert.equal(result.text, 'offline fallback succeeded')
  assert.equal(attempts.length, 2)
  assert.equal(attempts[0].p, 'browser-webgpu')
  assert.equal(attempts[0].ok, false)
  assert.equal(attempts[1].p, 'local-whisper')
  assert.equal(attempts[1].ok, true)
})
