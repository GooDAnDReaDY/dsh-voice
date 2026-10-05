import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
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

test('buildSensevoiceArgs supports Rockchip RK3588 NPU (rknn) and thread count (#221, #168)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rknn-npu-'))
  const realRknn = path.join(tmpDir, 'model.rknn')
  fs.writeFileSync(realRknn, 'dummy')
  try {
    const cfg = {
      sensevoiceModel: realRknn,
      sensevoiceProvider: 'rknn',
      sensevoiceThreads: 8,
    }
    const args = buildSensevoiceArgs(cfg, '6006')
    assert.ok(args.includes('--provider=rknn'), 'must include sherpa official --provider=rknn')
    assert.ok(args.includes('--num-threads=8'), 'must include --num-threads=8')
    assert.ok(args.includes('--port=6006'), 'must include port')
    assert.ok(args.includes('--sense-voice-model='), 'must include model path')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('buildSensevoiceArgs normalizes legacy rknpu to rknn provider when model exists (#221, #168)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rknn-legacy-'))
  const realRknn = path.join(tmpDir, 'model.rknn')
  fs.writeFileSync(realRknn, 'dummy')
  try {
    const cfg = {
      sensevoiceModel: realRknn,
      sensevoiceProvider: 'rknpu',
      sensevoiceThreads: 4,
    }
    const args = buildSensevoiceArgs(cfg, '6006')
    assert.ok(args.includes('--provider=rknn'), 'must normalize rknpu to --provider=rknn')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('buildSensevoiceArgs falls back to CPU when .rknn file does not exist (#168)', () => {
  const cfg = {
    sensevoiceModel: '/nonexistent/path/model.rknn',
    sensevoiceProvider: 'rknn',
    sensevoiceThreads: 4,
  }
  const args = buildSensevoiceArgs(cfg, '6006')
  assert.ok(!args.includes('--provider=rknn'), 'missing .rknn file must not pass --provider=rknn')
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

test('client-src/35-webgpu: loadWebGpuWhisper falls back to WASM when WebGPU is unavailable (#168)', async () => {
  const clientBundlePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'client.js')
  const clientCode = fs.readFileSync(clientBundlePath, 'utf8')

  const pipelineCalls = []
  const mockTransformers = {
    pipeline: async (task, model, opts) => {
      pipelineCalls.push({ task, model, opts })
      return async () => ({ text: 'mock offline transcript' })
    },
  }

  let loadedModule = null
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load({ factory }) {
          loadedModule = factory(() => ({}))
        },
      },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {},
    },
    document: {
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ dataset: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} } }),
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
    },
    navigator: {
      // No gpu: navigator.gpu is undefined
    },
    WebAssembly: {},
    __mockTransformers: mockTransformers,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    console,
  }
  sandbox.globalThis = sandbox

  vm.createContext(sandbox)
  vm.runInContext(clientCode, sandbox)

  const { isWebGpuSupported, isWasmSupported, isOfflineSupported, loadWebGpuWhisper } = loadedModule._test

  assert.equal(isWebGpuSupported(), false, 'WebGPU should be unsupported without navigator.gpu')
  assert.equal(isWasmSupported(), true, 'WASM should be supported when WebAssembly exists')
  assert.equal(isOfflineSupported(), true, 'Offline should be supported via WASM fallback')

  const transcriber = await loadWebGpuWhisper('onnx-community/whisper-tiny')
  assert.equal(typeof transcriber, 'function')
  assert.equal(pipelineCalls.length, 1)
  assert.equal(pipelineCalls[0].task, 'automatic-speech-recognition')
  assert.equal(pipelineCalls[0].model, 'onnx-community/whisper-tiny')
  assert.equal(pipelineCalls[0].opts.device, 'wasm', 'Must fall back to wasm device')
  assert.equal(pipelineCalls[0].opts.dtype, 'q8', 'Must use q8 dtype for wasm fallback')
})

test('client-src/35-webgpu: loadWebGpuWhisper falls back to WASM if WebGPU pipeline init throws (#168)', async () => {
  const clientBundlePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'client.js')
  const clientCode = fs.readFileSync(clientBundlePath, 'utf8')

  const pipelineCalls = []
  const mockTransformers = {
    pipeline: async (task, model, opts) => {
      pipelineCalls.push({ task, model, opts })
      if (opts.device === 'webgpu') {
        throw new Error('WebGPU device initialization failed')
      }
      return async () => ({ text: 'wasm fallback result' })
    },
  }

  let loadedModule = null
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load({ factory }) {
          loadedModule = factory(() => ({}))
        },
      },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {},
    },
    document: {
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ dataset: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} } }),
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
    },
    navigator: {
      gpu: {},
    },
    WebAssembly: {},
    __mockTransformers: mockTransformers,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    console,
  }
  sandbox.globalThis = sandbox

  vm.createContext(sandbox)
  vm.runInContext(clientCode, sandbox)

  const { isWebGpuSupported, isWasmSupported, isOfflineSupported, loadWebGpuWhisper } = loadedModule._test

  assert.equal(isWebGpuSupported(), true)
  assert.equal(isWasmSupported(), true)
  assert.equal(isOfflineSupported(), true)

  const transcriber = await loadWebGpuWhisper('onnx-community/whisper-tiny-fail-gpu')
  assert.equal(typeof transcriber, 'function')
  assert.equal(pipelineCalls.length, 2, 'Should attempt webgpu first then wasm fallback')
  assert.equal(pipelineCalls[0].opts.device, 'webgpu')
  assert.equal(pipelineCalls[1].opts.device, 'wasm')
  assert.equal(pipelineCalls[1].opts.dtype, 'q8')
})
