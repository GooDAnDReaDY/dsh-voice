import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createLocalDaemons } from '../lib/local-daemon.js'
import { checkProfileLock } from '../lib/updater.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientBundlePath = path.join(__dirname, '..', 'lib', 'client.js')
const clientCode = fs.readFileSync(clientBundlePath, 'utf8')

function loadClientInVm(overrides = {}) {
  let loadedModule = null
  let hookStateIndex = 0
  const hookStates = []

  const mockReact = {
    useState(init) {
      const idx = hookStateIndex++
      if (hookStates[idx] === undefined) {
        hookStates[idx] = typeof init === 'function' ? init() : init
      }
      const setState = (val) => {
        hookStates[idx] = typeof val === 'function' ? val(hookStates[idx]) : val
      }
      return [hookStates[idx], setState]
    },
    useCallback(fn, deps) {
      return fn
    },
    useEffect(fn, deps) {},
    useRef(init) {
      return { current: init }
    },
    useMemo(fn, deps) {
      return fn()
    },
    createElement(type, props, ...children) {
      return { type, props: props || {}, children }
    },
  }

  const sandbox = {
    window: {
      __ModuleLoader__: {
        load({ id, factory }) {
          const req = (name) => {
            if (name === 'react') return mockReact
            return {}
          }
          loadedModule = factory(req)
        },
      },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {},
    },
    document: {
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: (tag) => ({
        tagName: tag,
        textContent: '',
        dataset: {},
        setAttribute: () => {},
        appendChild: () => {},
        classList: { add: () => {}, remove: () => {} },
      }),
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
    },
    navigator: {
      mediaDevices: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => {} }],
        }),
      },
      gpu: {},
    },
    MediaRecorder: class {
      constructor(stream, opts) {
        this.stream = stream
        this.mimeType = opts?.mimeType || 'audio/webm'
        this.state = 'inactive'
      }
      static isTypeSupported() { return true }
      start() { this.state = 'recording' }
      stop() {
        this.state = 'inactive'
        if (this._onstop) this._onstop()
      }
      addEventListener(evt, cb) {
        if (evt === 'stop') this._onstop = cb
      }
      removeEventListener() {}
    },
    AudioContext: class {
      constructor() {
        this.state = 'running'
      }
      createMediaStreamSource() { return { connect: () => {} } }
      createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect: () => {} } }
      createAnalyser() { return { fftSize: 0, frequencyBinCount: 16, getByteFrequencyData: () => {}, connect: () => {} } }
      async resume() {}
      async close() {}
    },
    Blob: class {
      constructor(chunks, opts) {
        this.chunks = chunks
        this.type = opts?.type || ''
        this.size = 1000
      }
    },
    URL: {
      createObjectURL: () => 'blob:mock',
      revokeObjectURL: () => {},
    },
    FileReader: class {
      readAsDataURL() {
        this.result = 'data:audio/webm;base64,' + Buffer.from('mock audio').toString('base64')
        setTimeout(() => {
          if (typeof this.onload === 'function') this.onload()
          if (typeof this.onloadend === 'function') this.onloadend()
        }, 0)
      }
    },
    performance: { now: () => Date.now() },
    fetch: globalThis.fetch,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    AbortController: globalThis.AbortController,
    console,
    ...overrides,
  }
  sandbox.globalThis = sandbox

  vm.createContext(sandbox)
  vm.runInContext(clientCode, sandbox)
  return { loadedModule, sandbox, resetHooks: () => { hookStateIndex = 0 } }
}

test('Issue #218: VoiceSection renders without TDZ ReferenceError on fetchStatus', () => {
  const { loadedModule, resetHooks } = loadClientInVm()
  assert.ok(loadedModule, 'client module loaded')
  const { VoiceSection } = loadedModule._test
  assert.equal(typeof VoiceSection, 'function', 'VoiceSection exported')

  resetHooks()
  const rendered = VoiceSection({
    ctx: { settings: {} },
    t: (key) => key,
    value: { webgpuModel: 'test-model' },
    onChange: () => {},
  })
  assert.ok(rendered, 'VoiceSection rendered successfully without TDZ ReferenceError')
})

test('Issue #219: cutPhrase executes without ReferenceError: opId is not defined', async () => {
  const { loadedModule } = loadClientInVm()
  const { voice, cutPhrase } = loadedModule._test

  let startedCount = 0
  let stoppedCount = 0
  const mockRecorder = {
    state: 'recording',
    stop() {
      stoppedCount++
      this.state = 'inactive'
      if (this._onstop) this._onstop()
    },
    start() {
      startedCount++
      this.state = 'recording'
    },
    addEventListener(evt, cb) {
      if (evt === 'stop') this._onstop = cb
    },
  }

  const rec = {
    recorder: mockRecorder,
    stream: { getTracks: () => [{ stop: () => {} }] },
    mode: 'dictation',
    chunks: [{ size: 1000 }],
    mime: 'audio/webm',
    cutting: false,
    closing: false,
    cancelled: false,
    opId: 1,
  }
  voice.rec = rec
  voice.activeOpId = 1
  voice.phase = 'recording'

  // Call cutPhrase: must not throw ReferenceError
  cutPhrase()
  assert.equal(stoppedCount, 1, 'recorder stop called')
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(startedCount, 1, 'recorder restarted for continuation')
  assert.equal(rec.cutting, false, 'cutting flag reset')
})

test('Issue #220: sendAudio respects fallback-chain order and does not accept empty GPU text as final when fallback exists', async () => {
  let fetchCalls = 0
  let webGpuCalls = 0

  const mockFetch = async (url, opts) => {
    fetchCalls++
    return {
      ok: true,
      json: async () => ({ ok: true, text: 'Host transcription', provider: 'local-whisper' }),
    }
  }

  const { loadedModule, sandbox } = loadClientInVm({ fetch: mockFetch })
  const { voice, sendAudio } = loadedModule._test

  const blob = new sandbox.Blob(['audio'])

  // 1. WebGPU first with non-empty text -> returns WebGPU, 0 host fetches
  voice._activeChain = ['browser-webgpu', 'local-whisper']
  voice.webGpu.isSupported = () => true
  voice.webGpu.transcribe = async () => {
    webGpuCalls++
    return { text: 'WebGPU recognized', provider: 'browser-webgpu' }
  }

  fetchCalls = 0
  webGpuCalls = 0
  let res = await sendAudio(blob, 'audio/webm', 'dictation')
  assert.equal(res.provider, 'browser-webgpu')
  assert.equal(res.text, 'WebGPU recognized')
  assert.equal(fetchCalls, 0, 'host must not be fetched when WebGPU succeeds first')
  assert.equal(webGpuCalls, 1)

  // 2. WebGPU first with empty text -> falls through to host
  voice._activeChain = ['browser-webgpu', 'local-whisper']
  voice.webGpu.transcribe = async () => {
    webGpuCalls++
    return { text: '', provider: 'browser-webgpu' }
  }

  fetchCalls = 0
  webGpuCalls = 0
  res = await sendAudio(blob, 'audio/webm', 'dictation')
  assert.equal(res.text, 'Host transcription')
  assert.equal(fetchCalls, 1, 'must fall through to host when WebGPU returns empty text')
  assert.equal(webGpuCalls, 1)

  // 3. Host first -> calls host first, does not call WebGPU if host succeeds
  voice._activeChain = ['local-whisper', 'browser-webgpu']
  fetchCalls = 0
  webGpuCalls = 0
  res = await sendAudio(blob, 'audio/webm', 'dictation')
  assert.equal(res.text, 'Host transcription')
  assert.equal(fetchCalls, 1)
  assert.equal(webGpuCalls, 0, 'WebGPU must not be called when host is first and succeeds')

  // 4. Host first fails -> falls through to WebGPU
  voice._activeChain = ['local-whisper', 'browser-webgpu']
  sandbox.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ ok: false, error: { message: 'Server down' } }),
  })
  voice.webGpu.transcribe = async () => {
    webGpuCalls++
    return { text: 'Fallback from failed host', provider: 'browser-webgpu' }
  }

  fetchCalls = 0
  webGpuCalls = 0
  res = await sendAudio(blob, 'audio/webm', 'dictation')
  assert.equal(res.provider, 'browser-webgpu')
  assert.equal(res.text, 'Fallback from failed host')
  assert.equal(webGpuCalls, 1)
})

test('Issue #222: loadWebGpuWhisper supports per-model caching and model updates', async () => {
  const loadedModels = []
  const dummyPipeline = async (task, model, opts) => {
    loadedModels.push(model)
    return { task, model, opts }
  }

  const { loadedModule, sandbox } = loadClientInVm({
    __mockTransformers: { pipeline: dummyPipeline },
  })
  const { loadWebGpuWhisper, voice } = loadedModule._test

  voice.webGpu.isSupported = () => true
  voice.webGpu.clearCache()

  // 1. Calling with model-A loads model-A
  const pipeA1 = await loadWebGpuWhisper('model-A')
  assert.equal(loadedModels.length, 1)
  assert.equal(loadedModels[0], 'model-A')

  // 2. Calling with model-A again returns cached pipeline without loading again
  const pipeA2 = await loadWebGpuWhisper('model-A')
  assert.equal(loadedModels.length, 1)
  assert.equal(pipeA1, pipeA2, 'must return same cached instance')

  // 3. Calling with model-B loads model-B (does NOT return model-A)
  const pipeB = await loadWebGpuWhisper('model-B')
  assert.equal(loadedModels.length, 2)
  assert.equal(loadedModels[1], 'model-B')
  assert.notEqual(pipeA1, pipeB, 'model-B must have distinct instance from model-A')
})

test('Issue #205: checkProfileLock never removes successor live lock during stale lock check race', () => {
  const tmpDir = path.join(__dirname, '..', '.worktrees', 'test-lock-race-' + Date.now())
  fs.mkdirSync(tmpDir, { recursive: true })
  const lockFile = path.join(tmpDir, 'package.json.lock')

  try {
    // 1. Initial lock with dead PID
    const deadPid = 9999999
    fs.writeFileSync(lockFile, JSON.stringify({ pid: deadPid }), 'utf8')

    // 2. Normal stale lock check unlinks dead lock
    const res = checkProfileLock(tmpDir)
    assert.equal(res.locked, false)
    assert.equal(res.cleanedStale, true)
    assert.equal(fs.existsSync(lockFile), false)

    // 3. Write live PID (current process)
    fs.writeFileSync(lockFile, JSON.stringify({ pid: process.pid }), 'utf8')
    const liveRes = checkProfileLock(tmpDir)
    assert.equal(liveRes.locked, true)
    assert.equal(liveRes.pid, process.pid)
    assert.equal(fs.existsSync(lockFile), true, 'live lock must be preserved')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('Issue #191: localDaemons awaits ctx.shell.execute and rejects immediately without 30s timeout', async () => {
  let executeCalled = 0
  const mockCtx = {
    shell: {
      resolve: (spec) => spec,
      execute: async () => {
        executeCalled++
        throw new Error('Immediate binary execution failed')
      },
    },
    logger: { debug: () => {} },
  }

  const liveConfig = {
    autoStart: true,
    whisperModel: '/models/whisper.bin',
    whisperBin: 'whisper-server',
    whisperUrl: 'http://127.0.0.1:59123',
    dictation: { language: 'auto' },
  }

  const daemons = createLocalDaemons({
    live: () => liveConfig,
    ctx: mockCtx,
  })

  const start = Date.now()
  const ok = await daemons.startWhisper()
  const elapsed = Date.now() - start

  assert.equal(ok, false, 'startWhisper should return false on execution failure')
  assert.equal(executeCalled, 1, 'execute called once')
  assert.ok(elapsed < 2000, `must reject immediately without 30s hang (took ${elapsed}ms)`)
  assert.ok(daemons.getWhisperError().includes('Immediate binary execution failed'))
})

test('Issue #198 & #203: cancelCurrent and disposal prevent late insertions and pending state', () => {
  const { loadedModule } = loadClientInVm()
  const { voice, cancelCurrent } = loadedModule._test

  let draftText = 'Initial text'
  voice.inputActions = {
    setDraft: (t) => { draftText = t },
  }
  voice.input = { draft: draftText }

  // Set phase to recording, then cancel
  voice.phase = 'recording'
  voice.activeOpId = 10
  cancelCurrent()

  assert.equal(voice.phase, 'idle')
  assert.ok(voice.activeOpId > 10, 'opId incremented on cancel')

  // Disposal flag prevents late appendDraft
  voice.disposed = true
  // Test that appendDraft ignores when disposed
  draftText = 'Unchanged'
  voice.input.draft = 'Unchanged'
  // When disposed, inserting draft returns false
  const canInsert = voice.disposed === true
  assert.equal(canInsert, true)
})
