import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createLocalDaemons } from '../lib/local-daemon.js'
import { checkProfileLock } from '../lib/updater.js'
import { buildSensevoiceArgs } from '../lib/sensevoice-installer.js'

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
        this.chunks = chunks || []
        this.type = opts?.type || ''
        this.size = (opts && opts.size !== undefined) ? opts.size : 2000
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

  return { loadedModule, sandbox }
}

test('Issue #218: VoiceSection renders without TDZ ReferenceError on fetchStatus', () => {
  const { loadedModule } = loadClientInVm()
  const { VoiceSection } = loadedModule._test

  assert.ok(VoiceSection, 'VoiceSection must be exported')
  assert.doesNotThrow(() => {
    VoiceSection({
      mode: 'dictation',
      data: {
        modes: { dictation: { chain: [] } },
      },
    })
  }, 'VoiceSection render must not throw TDZ ReferenceError')
})

test('Issue #219: cutPhrase executes without ReferenceError: opId is not defined', async () => {
  const { loadedModule, sandbox } = loadClientInVm()
  const { voice, cutPhrase } = loadedModule._test

  let startedCount = 0
  const mockRec = {
    opId: 42,
    mode: 'dictation',
    chunks: [new sandbox.Blob(['mock'])],
    mime: 'audio/webm',
    cutting: false,
    closing: false,
    silenceMs: 0,
    hadSpeech: true,
    streamMs: 0,
    stream: { getTracks: () => [{ stop: () => {} }] },
    recorder: {
      state: 'recording',
      stop() {
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
    },
  }

  voice.rec = mockRec
  voice.phase = 'recording'
  voice.activeOpId = 42

  await assert.doesNotReject(async () => {
    cutPhrase()
    await new Promise((r) => setTimeout(r, 20))
  }, 'cutPhrase must not throw ReferenceError: opId is not defined')

  const rec = voice.rec
  assert.ok(rec, 'rec should still exist')
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

test('Issue #222: loadWebGpuWhisper shares in-flight Promise across concurrent loads of the same model', async () => {
  let pipelineCalls = 0
  let resolvePipeline = null

  const dummyPipeline = (task, model, opts) => {
    pipelineCalls++
    return new Promise((resolve) => {
      resolvePipeline = () => resolve({ task, model, opts })
    })
  }

  const { loadedModule } = loadClientInVm({
    __mockTransformers: { pipeline: dummyPipeline },
  })
  const { loadWebGpuWhisper, voice } = loadedModule._test

  voice.webGpu.isSupported = () => true
  voice.webGpu.clearCache()

  const promiseA1 = loadWebGpuWhisper('model-A')
  const promiseA2 = loadWebGpuWhisper('model-A')

  assert.equal(promiseA1, promiseA2, 'concurrent calls for same model must return the identical Promise')
  assert.equal(pipelineCalls, 1, 'pipeline should only be invoked once for model-A')

  resolvePipeline()
  const [instA1, instA2] = await Promise.all([promiseA1, promiseA2])
  assert.equal(instA1, instA2)
})

test('Issue #205: checkProfileLock atomic rename coordinator prevents deleting successor live lock', () => {
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
    try {
      if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile)
      if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir)
    } catch (_) {}
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

test('Issue #191: localDaemons kills handle if disposed while ctx.shell.execute was pending', async () => {
  let killed = 0
  let resolveExecute = null
  let executeCalled = false

  const mockCtx = {
    shell: {
      resolve: (spec) => spec,
      execute: () => {
        executeCalled = true
        return new Promise((resolve) => {
          resolveExecute = () => resolve({
            status: 'running',
            done: Promise.resolve(),
            kill: () => { killed++ },
          })
        })
      },
    },
    logger: { debug: () => {} },
  }

  const daemons = createLocalDaemons({
    live: () => ({
      autoStart: true,
      whisperModel: '/models/whisper.bin',
      whisperBin: 'whisper-server',
      whisperUrl: 'http://127.0.0.1:59123',
      dictation: { language: 'auto' },
    }),
    ctx: mockCtx,
  })

  const startPromise = daemons.startWhisper()

  for (let i = 0; i < 50; i++) {
    if (executeCalled) break
    await new Promise((r) => setTimeout(r, 10))
  }
  assert.ok(executeCalled, 'shell.execute must be invoked')

  daemons.dispose()
  resolveExecute()
  const ok = await startPromise

  assert.equal(ok, false, 'startWhisper should return false if disposed')
  assert.equal(killed, 1, 'in-flight process handle must be killed on late resolution')
})

test('Issue #225: normal browser stop preserves last final result; cancelCurrent discards it', async () => {
  let finalCb = null

  class MockSpeechRecognition {
    constructor() {
      this.continuous = true
    }
    start() {}
    stop() {
      if (finalCb) {
        const item = [{ transcript: 'Last phrase' }]
        item.isFinal = true
        finalCb({
          resultIndex: 0,
          results: [item],
        })
      }
      if (this._onend) {
        this._onend()
      }
      return Promise.resolve()
    }
    abort() {}
    set onresult(cb) { finalCb = cb }
    get onresult() { return finalCb }
    set onend(cb) { this._onend = cb }
    get onend() { return this._onend }
    set onerror(cb) {}
  }

  const { loadedModule, sandbox } = loadClientInVm()
  sandbox.window.SpeechRecognition = MockSpeechRecognition
  sandbox.window.webkitSpeechRecognition = MockSpeechRecognition

  const { voice, startRecording, stopCurrent, cancelCurrent } = loadedModule._test

  voice.settings.localOnly = false
  voice.settings.autoSendMs = 3000
  let draft = ''
  voice.inputActions = { setDraft: (t) => { draft = t } }
  voice.input = { draft: '' }
  voice._chainsPromise = Promise.resolve({
    message: { chain: ['browser'], language: 'en' },
  })

  // 1. Normal stop preserves final chunk
  startRecording('message')
  await new Promise((r) => setTimeout(r, 30))
  assert.equal(voice.phase, 'recording')
  assert.ok(voice.browser, 'browser leg started')

  stopCurrent()
  await new Promise((r) => setTimeout(r, 30))

  assert.equal(draft, 'Last phrase', 'normal stop must insert the final speech chunk')
  assert.equal(voice.phase, 'pending', 'message mode transitions to pending after normal stop')
  assert.equal(voice.pending?.text, 'Last phrase')

  // 2. Cancellation during recording discards
  draft = ''
  voice.phase = 'idle'
  startRecording('message')
  await new Promise((r) => setTimeout(r, 30))
  assert.equal(voice.phase, 'recording')

  cancelCurrent()
  assert.equal(voice.phase, 'idle')
  assert.equal(draft, '', 'cancelled recording must not insert text')
})

test('Issue #226: openMic terminates all MediaStream tracks if MediaRecorder constructor throws', async () => {
  let tracksStopped = 0
  const mockTrack = {
    stop: () => { tracksStopped++ },
  }
  const mockStream = {
    getTracks: () => [mockTrack, mockTrack],
  }

  class FaultyMediaRecorder {
    constructor() {
      throw new Error('MediaRecorder construction failed')
    }
    static isTypeSupported() { return true }
  }

  const { loadedModule } = loadClientInVm({
    MediaRecorder: FaultyMediaRecorder,
    navigator: {
      mediaDevices: {
        getUserMedia: async () => mockStream,
      },
      gpu: {},
    },
  })
  const { openMic } = loadedModule._test

  await assert.rejects(
    () => openMic('dictation', 1),
    /MediaRecorder construction failed/,
  )

  assert.equal(tracksStopped, 2, 'all tracks must be stopped on MediaRecorder error')
})

test('Issue #197: VAD cut phrases and normal stop tail chunk insert in strict FIFO sequence', async () => {
  const inserts = []
  let sendAudioCalls = 0

  const mockFetch = async () => ({
    ok: true,
    json: async () => {
      sendAudioCalls++
      return { ok: true, text: sendAudioCalls === 1 ? 'First phrase' : 'Tail' }
    },
  })

  const { loadedModule, sandbox } = loadClientInVm({ fetch: mockFetch })
  const { voice, cutPhrase, stopCurrent } = loadedModule._test

  voice.inputActions = {
    setDraft: (t) => { inserts.push(t) },
  }
  voice.input = { draft: '' }
  voice.phase = 'recording'
  voice.mode = 'dictation'
  voice.activeOpId = 5

  const mockRec = {
    opId: 5,
    mode: 'dictation',
    chunks: [new sandbox.Blob(['phrase1'])],
    mime: 'audio/webm',
    cutting: false,
    closing: false,
    stream: { getTracks: () => [{ stop: () => {} }] },
    recorder: {
      state: 'recording',
      stop() {
        this.state = 'inactive'
        if (this._onstop) this._onstop()
      },
      start() { this.state = 'recording' },
      addEventListener(evt, cb) { if (evt === 'stop') this._onstop = cb },
    },
  }
  voice.rec = mockRec

  cutPhrase()
  mockRec.chunks = [new sandbox.Blob(['tail'])]
  stopCurrent()

  await new Promise((r) => setTimeout(r, 50))

  assert.equal(sendAudioCalls, 2, 'both cut phrase and tail must be sent')
  assert.ok(inserts.length >= 2, 'both phrases must be appended')
  assert.ok(inserts[0].includes('First phrase'), 'first phrase must be inserted first')
  assert.ok(inserts[1].includes('Tail'), 'tail phrase must be inserted after first phrase')
})

test('Issue #198: transcription binds to original composer session and does not write to active switched session', async () => {
  let resolveAudio = null
  const mockFetch = async () => ({
    ok: true,
    json: async () => new Promise((resolve) => {
      resolveAudio = () => resolve({ ok: true, text: 'Audio result from Session A' })
    }),
  })

  const { loadedModule, sandbox } = loadClientInVm({ fetch: mockFetch })
  const { voice, startRecording, stopCurrent } = loadedModule._test

  let sessionADraft = ''
  let sessionBDraft = ''

  voice._chainsPromise = Promise.resolve({
    dictation: { chain: ['local-whisper'], language: 'en' },
  })

  // Start in Session A
  voice.inputActions = { setDraft: (t) => { sessionADraft = t } }
  voice.input = { draft: '' }
  startRecording('dictation')
  await new Promise((r) => setTimeout(r, 30))

  if (voice.rec) {
    voice.rec.chunks.push(new sandbox.Blob(['long-enough-audio-chunk']))
  }
  stopCurrent()

  // User switches active session to Session B while ASR is pending
  voice.inputActions = { setDraft: (t) => { sessionBDraft = t } }
  voice.input = { draft: '' }

  for (let i = 0; i < 50; i++) {
    if (resolveAudio) break
    await new Promise((r) => setTimeout(r, 10))
  }
  assert.ok(resolveAudio, 'audio request in flight')
  resolveAudio()
  await new Promise((r) => setTimeout(r, 30))

  assert.equal(sessionADraft, 'Audio result from Session A', 'must write to initiating composer A')
  assert.equal(sessionBDraft, '', 'must NOT write to currently active composer B')
})

test('Issue #203: delayed MediaRecorder stop event after disposal does not trigger sendAudio or set phase to pending', async () => {
  let sendAudioCalls = 0
  const mockFetch = async () => {
    sendAudioCalls++
    return { ok: true, json: async () => ({ ok: true, text: 'Late text' }) }
  }

  const { loadedModule, sandbox } = loadClientInVm({ fetch: mockFetch })
  const { voice } = loadedModule._test

  let stopListener = null
  const mockRec = {
    opId: 1,
    mode: 'message',
    chunks: [new sandbox.Blob(['audio'])],
    mime: 'audio/webm',
    closing: false,
    cancelled: false,
    stream: { getTracks: () => [{ stop: () => {} }] },
    recorder: {
      state: 'recording',
      stop() { this.state = 'inactive' },
      addEventListener(evt, cb) { if (evt === 'stop') stopListener = cb },
    },
  }
  voice.rec = mockRec
  voice.phase = 'recording'
  voice.activeOpId = 1

  loadedModule._test.stopCurrent()

  // Disposer runs before stopListener fires
  voice.disposed = true

  assert.ok(stopListener, 'stopListener was registered')
  stopListener()

  await new Promise((r) => setTimeout(r, 30))

  assert.equal(sendAudioCalls, 0, 'sendAudio must not be called after disposal')
  assert.notEqual(voice.phase, 'pending', 'voice phase must not transition to pending')
})


test('Issue #198: native TokenSpan and draftRev guard prevent overwriting edited user text', async () => {
  let draft = 'seed'
  let rev = 1
  let captured = 0
  const insertArgs = []
  let resolveAudio = null

  const mockFetch = async (url) => {
    if (url.endsWith('/status')) {
      return { json: async () => ({ modes: { message: { chain: [{ provider: 'local-whisper' }] } } }) }
    }
    return new Promise((resolve) => { resolveAudio = resolve })
  }

  const { loadedModule, sandbox } = loadClientInVm({ fetch: mockFetch })
  const { voice, startRecording, stopCurrent } = loadedModule._test

  voice.input = { draft }
  voice.inputActions = {
    captureInsertion: () => {
      captured++
      return { start: 4, end: 4, draftRev: rev }
    },
    insertText: (text, span) => {
      insertArgs.push({ text, span })
      if (span.draftRev !== rev) return false
      draft += text
      return true
    },
    setDraft: (t) => { draft = t },
  }

  startRecording('message')
  await new Promise((r) => setTimeout(r, 20))
  if (voice.rec) {
    voice.rec.chunks.push(new sandbox.Blob(['x'.repeat(2000)]))
  }
  stopCurrent()
  await new Promise((r) => setTimeout(r, 20))

  // User edits the draft concurrently while ASR is pending
  draft = 'seed user edited'
  rev++
  voice.input = { draft }

  // ASR resolves with late transcript
  assert.ok(resolveAudio, 'resolveAudio should be set')
  resolveAudio({ ok: true, json: async () => ({ ok: true, text: 'Transcript' }) })
  await new Promise((r) => setTimeout(r, 30))

  assert.equal(captured, 1, 'captureInsertion must be called at recording start')
  assert.equal(insertArgs.length, 1, 'insertText must be invoked')
  assert.equal(insertArgs[0].text, 'Transcript')
  assert.deepEqual(insertArgs[0].span, { start: 4, end: 4, draftRev: 1 }, 'original TokenSpan must be passed to insertText')
  assert.equal(draft, 'seed user edited', 'user edits must NOT be overwritten when insertText rejects stale revision')
})

test('Issue #198: session switch binds transcription and submitPending to initiating session', async () => {
  let sessionADraft = 'chat A'
  let sessionBDraft = 'chat B'
  const submits = []
  let resolveAudio = null

  const mockFetch = async (url) => {
    if (url.endsWith('/status')) {
      return { json: async () => ({ modes: { message: { chain: [{ provider: 'local-whisper' }] } } }) }
    }
    return new Promise((resolve) => { resolveAudio = resolve })
  }

  const { loadedModule, sandbox } = loadClientInVm({ fetch: mockFetch })
  const { voice, startRecording, stopCurrent, submitPending } = loadedModule._test

  // Session A is active at start
  voice.input = { draft: sessionADraft }
  voice.inputActions = {
    setDraft: (t) => { sessionADraft = t },
    submit: () => { submits.push('A') },
  }

  startRecording('message')
  await new Promise((r) => setTimeout(r, 20))
  if (voice.rec) {
    voice.rec.chunks.push(new sandbox.Blob(['x'.repeat(2000)]))
  }
  stopCurrent()
  await new Promise((r) => setTimeout(r, 20))

  // User switches to Session B while ASR is pending
  voice.input = { draft: sessionBDraft }
  voice.inputActions = {
    setDraft: (t) => { sessionBDraft = t },
    submit: () => { submits.push('B') },
  }

  // ASR resolves
  assert.ok(resolveAudio, 'resolveAudio should be set')
  resolveAudio({ ok: true, json: async () => ({ ok: true, text: 'Old chat result' }) })
  await new Promise((r) => setTimeout(r, 30))

  assert.equal(voice.phase, 'pending', 'voice phase should be pending')
  assert.ok(sessionADraft.includes('Old chat result'), 'Session A draft must receive transcription')
  assert.equal(sessionBDraft, 'chat B', 'Session B draft must NOT be altered')

  // Auto-send or submitPending fires
  submitPending()
  await new Promise((r) => setTimeout(r, 20))

  assert.deepEqual(submits, ['A'], 'submitPending must submit initiating session A, not active session B')
  assert.equal(voice.phase, 'idle')
})

test('Issue #205: checkProfileLock unlinks dead lock in-place without renaming away to protect successors', () => {
  const tmpDir = path.join(__dirname, '..', '.worktrees', 'test-lock-successor-' + Date.now())
  fs.mkdirSync(tmpDir, { recursive: true })
  const lockFile = path.join(tmpDir, 'package.json.lock')

  try {
    // 1. Initial lock has dead PID
    const deadPid = 9999999
    fs.writeFileSync(lockFile, String(deadPid), 'utf8')

    // 2. Run checkProfileLock
    const out = checkProfileLock(tmpDir)
    assert.equal(out.locked, false)
    assert.equal(out.cleanedStale, true)
    assert.equal(fs.existsSync(lockFile), false, 'dead lock should be unlinked')

    // 3. Successor lock written concurrently with live PID
    fs.writeFileSync(lockFile, String(process.pid), 'utf8')
    const out2 = checkProfileLock(tmpDir)
    assert.equal(out2.locked, true)
    assert.equal(out2.pid, process.pid)
    assert.equal(fs.existsSync(lockFile), true, 'live successor lock must remain intact')
  } finally {
    try {
      if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile)
      if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir)
    } catch (_) {}
  }
})

test('Issue #191: localDaemons awaits async child.result() and extracts exitCode and stderr', async () => {
  let healthCalls = 0
  const mockFetch = async () => {
    healthCalls++
    return { ok: false }
  }

  const oldFetch = globalThis.fetch
  globalThis.fetch = mockFetch

  try {
    const d = createLocalDaemons({
      live: () => ({
        autoStart: true,
        whisperModel: 'fixture',
        whisperBin: 'fixture',
        whisperUrl: 'http://127.0.0.1:59999',
        dictation: { language: '' },
      }),
      ctx: {
        shell: {
          resolve: (x) => x,
          execute: async () => ({
            status: 'completed',
            exitCode: 7,
            done: Promise.resolve(),
            result: async () => ({ exitCode: 7, stderr: 'CUDA out of memory' }),
            kill: () => false,
          }),
        },
      },
    })

    const started = await d.startWhisper()
    assert.equal(started, false)
    const err = d.getWhisperError()
    assert.ok(err.includes('code 7'), `error should mention code 7: ${err}`)
    assert.ok(err.includes('CUDA out of memory'), `error should include stderr detail: ${err}`)
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('Issue #221: buildSensevoiceArgs guards against plain .onnx on RKNN provider and falls back to CPU', () => {
  // 1. Plain .onnx without .rknn file must fall back to CPU (omit --provider=rknn)
  const argsCpuFallback = buildSensevoiceArgs(
    { sensevoiceModel: 'model.int8.onnx', sensevoiceProvider: 'rknn', sensevoiceTokens: 'tokens.txt' },
    '6006',
  )
  assert.ok(!argsCpuFallback.includes('--provider=rknn'), 'plain onnx without rknn model must not pass --provider=rknn')

  // 2. If a .rknn model is specified, RKNN provider is retained
  const argsRknn = buildSensevoiceArgs(
    { sensevoiceModel: 'model.rknn', sensevoiceProvider: 'rknn' },
    '6006',
  )
  assert.ok(argsRknn.includes('--provider=rknn'), 'rknn model must include --provider=rknn')
})

test('Issue #198: multiphase dictation refreshes TokenSpan on accepted insert across phrase cuts', async () => {
  let draft = ''
  let rev = 1
  let captures = 0
  let requests = 0
  const calls = []

  const mockFetch = async (url) => {
    if (url.endsWith('/status')) {
      return { json: async () => ({ modes: { dictation: { chain: [{ provider: 'local-whisper' }] } } }) }
    }
    requests++
    return { ok: true, json: async () => ({ ok: true, text: ['First', 'Second', 'Tail'][requests - 1] }) }
  }

  const { loadedModule, sandbox } = loadClientInVm({ fetch: mockFetch })
  const { voice, startRecording, cutPhrase, stopCurrent } = loadedModule._test

  voice.input = { draft }
  voice.inputActions = {
    captureInsertion: () => {
      captures++
      return { start: draft.length, end: draft.length, draftRev: rev }
    },
    insertText: (text, span) => {
      const accepted = span.draftRev === rev
      calls.push({ text, spanRev: span.draftRev, currentRev: rev, accepted })
      if (!accepted) return false
      draft += text
      rev++
      return true
    },
    setDraft: () => { throw new Error('Native fallback must not execute') },
  }

  startRecording('dictation')
  await new Promise((r) => setTimeout(r, 20))
  const rec = voice.rec
  assert.ok(rec, 'recording session must be active')

  rec.chunks.push(new sandbox.Blob(['x'.repeat(1000)]))
  cutPhrase()
  await new Promise((r) => setTimeout(r, 30))

  rec.chunks.push(new sandbox.Blob(['y'.repeat(1000)]))
  cutPhrase()
  await new Promise((r) => setTimeout(r, 30))

  rec.chunks.push(new sandbox.Blob(['z'.repeat(1000)]))
  stopCurrent()
  await new Promise((r) => setTimeout(r, 40))

  assert.equal(requests, 3, 'all 3 audio requests must be dispatched')
  assert.equal(calls.length, 3, 'all 3 phrases must be submitted for insertion')
  assert.ok(calls.every((c) => c.accepted), 'every phrase must be accepted with advancing revision')
  assert.equal(draft, 'FirstSecondTail', 'all speech segments must be appended in sequence')
  assert.equal(voice.phase, 'idle')
})

test('Issue #198: rejected insertText suppresses pending phase and prevents premature auto-send', async () => {
  let draft = 'seed'
  let rev = 1
  let resolveAudio = null
  const submits = []

  const mockFetch = async (url) => {
    if (url.endsWith('/status')) {
      return { json: async () => ({ modes: { message: { chain: [{ provider: 'local-whisper' }] } } }) }
    }
    return new Promise((r) => { resolveAudio = r })
  }

  const { loadedModule, sandbox } = loadClientInVm({ fetch: mockFetch })
  const { voice, startRecording, stopCurrent, submitPending } = loadedModule._test

  voice.input = { draft }
  voice.inputActions = {
    captureInsertion: () => ({ start: 4, end: 4, draftRev: rev }),
    insertText: (text, span) => {
      if (span.draftRev !== rev) return false
      draft += text
      rev++
      return true
    },
    submit: () => submits.push(draft),
  }

  startRecording('message')
  await new Promise((r) => setTimeout(r, 20))
  voice.rec.chunks.push(new sandbox.Blob(['x'.repeat(2000)]))
  stopCurrent()
  await new Promise((r) => setTimeout(r, 20))

  // User manually edits the draft while recognition is pending
  draft = 'seed user edited'
  rev++
  voice.input = { draft }

  // ASR arrives with text
  resolveAudio({ ok: true, json: async () => ({ ok: true, text: 'Voice text rejected' }) })
  await new Promise((r) => setTimeout(r, 30))

  // Verify pending was NOT activated because insertion was rejected
  assert.notEqual(voice.phase, 'pending', 'voice phase must not transition to pending on rejected insertion')
  assert.equal(voice.pending, null, 'voice.pending must remain null on rejected insertion')

  // Auto-send timer or submitPending must do nothing
  submitPending()
  await new Promise((r) => setTimeout(r, 20))

  assert.deepEqual(submits, [], 'user draft must not be auto-submitted if voice text was rejected')
  assert.equal(draft, 'seed user edited', 'user edit must be preserved')
})

test('Issue #205: checkProfileLock guards against deleting live successor lock written concurrently', () => {
  const tmpDir = path.join(__dirname, '..', '.worktrees', 'test-lock-live-successor-' + Date.now())
  fs.mkdirSync(tmpDir, { recursive: true })
  const lock = path.join(tmpDir, 'package.json.lock')
  fs.writeFileSync(lock, '99999999')

  try {
    let reads = 0
    const sandbox = {
      Date, Math, resolve: path.resolve, existsSync: fs.existsSync, statSync: fs.statSync, unlinkSync: fs.unlinkSync,
      isProcessAlive: (p) => p === process.pid,
      readLockPid: (p) => {
        reads++
        const observed = Number(fs.readFileSync(p, 'utf8'))
        // Concurrent writer acquires live lock at read 2
        if (reads === 2) fs.writeFileSync(p, String(process.pid))
        return observed
      },
    }

    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'updater.js'), 'utf8')
    const fn = src.match(/export function checkProfileLock\(profileDir\) \{[\s\S]*?\n\}/)[0].replace('export ', '')
    vm.createContext(sandbox)
    vm.runInContext(fn + ';globalThis.check=checkProfileLock;', sandbox)

    const out = sandbox.check(tmpDir)
    assert.equal(out.locked, true, 'must detect live successor lock')
    assert.equal(out.pid, process.pid, 'must report live successor PID')
    assert.equal(fs.existsSync(lock), true, 'live successor lock must not be deleted')
  } finally {
    try {
      if (fs.existsSync(lock)) fs.unlinkSync(lock)
      if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir)
    } catch (_) {}
  }
})

test('Issue #191: localDaemons reads child.readOutput() and handles result rejection for spawn failure stderr', async () => {
  let reads = 0
  let results = 0

  const oldFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false })

  try {
    const d = createLocalDaemons({
      live: () => ({
        autoStart: true,
        whisperModel: 'fixture',
        whisperBin: 'fixture',
        whisperUrl: 'http://127.0.0.1:9999',
        dictation: { language: '' },
      }),
      ctx: {
        shell: {
          resolve: (x) => x,
          execute: async () => ({
            status: 'killed',
            exitCode: null,
            done: Promise.resolve(),
            readOutput: () => {
              reads++
              return { stderr: 'Provider spawn rejected: Sandbox unavailable', stdout: '' }
            },
            result: async () => {
              results++
              throw new Error('Provider spawn rejected: Sandbox unavailable')
            },
            kill: () => false,
          }),
        },
      },
    })

    const started = await d.startWhisper()
    assert.equal(started, false)
    assert.ok(reads >= 1, 'child.readOutput must be called')
    const err = d.getWhisperError()
    assert.ok(err.includes('Provider spawn rejected: Sandbox unavailable'), `error should contain detail: ${err}`)
  } finally {
    globalThis.fetch = oldFetch
  }
})
