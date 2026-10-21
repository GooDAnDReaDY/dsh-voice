import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

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
      const setter = (val) => {
        hookStates[idx] = typeof val === 'function' ? val(hookStates[idx]) : val
      }
      return [hookStates[idx], setter]
    },
    useRef(init) {
      return { current: init }
    },
    useEffect() {},
    useMemo(fn) {
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
      createElement: () => ({
        setAttribute() {},
        appendChild() {},
        style: {},
        dataset: {},
      }),
      head: { appendChild() {} },
    },
    fetch: overrides.fetch || (async () => ({ ok: true, json: async () => ({}) })),
    Blob: globalThis.Blob,
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    console,
  }

  vm.createContext(sandbox)
  vm.runInContext(clientCode, sandbox)
  return { loadedModule, sandbox }
}

test('Issue #170: initPendingPreview initializes raw and polished comparison state', async () => {
  const { loadedModule } = loadClientInVm()
  const { initPendingPreview } = loadedModule._test

  const target = {
    initialDraft: 'Hello draft',
    sessionId: 'session-123',
    actions: {},
  }

  // 1. Without polish: rawText equals activeText, raw tab selected
  const p1 = initPendingPreview('test spoken text', target, { autoSendMs: 5000, polishSend: false })
  assert.equal(p1.rawText, 'test spoken text')
  assert.equal(p1.text, 'test spoken text')
  assert.equal(p1.activeText, 'test spoken text')
  assert.equal(p1.selectedTab, 'raw')
  assert.equal(p1.isEditing, false)
  assert.equal(p1.sessionId, 'session-123')
  assert.equal(p1.initialDraft, 'Hello draft')
  assert.equal(p1.totalMs, 5000)
  assert.equal(p1.leftMs, 5000)

  // 2. With polish diff: polished tab active
  const p2 = initPendingPreview('raw stutter', target, {
    autoSendMs: 4000,
    polishedText: 'clean text',
    polishSend: true,
  })
  assert.equal(p2.rawText, 'raw stutter')
  assert.equal(p2.polishedText, 'clean text')
  assert.equal(p2.activeText, 'clean text')
  assert.equal(p2.selectedTab, 'polished')
})

test('Issue #170: cancelPending restores initialDraft and resets to idle', async () => {
  const { loadedModule } = loadClientInVm()
  const { voice, initPendingPreview, cancelPending } = loadedModule._test

  let restoredDraft = ''
  const target = {
    initialDraft: 'Existing user draft',
    sessionId: 'session-abc',
    actions: {
      setDraft: (val) => { restoredDraft = val },
    },
  }

  voice.pending = initPendingPreview('Recognized text', target)
  voice.phase = 'pending'

  cancelPending()

  assert.equal(restoredDraft, 'Existing user draft', 'Cancel must restore initial composer draft')
  assert.equal(voice.phase, 'idle', 'Phase must return to idle')
  assert.equal(voice.pending, null, 'Pending preview must be cleared')
})

test('Issue #170: submitPending pins to conversation and guards against session switch', async () => {
  const { loadedModule } = loadClientInVm()
  const { voice, initPendingPreview, submitPending } = loadedModule._test

  const submitted = []
  let currentDraft = ''
  const target = {
    initialDraft: 'Draft A',
    sessionId: 'session-A',
    actions: {
      setDraft: (val) => { currentDraft = val },
      submit: () => { submitted.push(currentDraft) },
    },
  }

  voice.pending = initPendingPreview('Speech text', target)
  voice.phase = 'pending'
  voice.currentSessionId = 'session-B' // User switched conversation!

  submitPending()

  // Guard must trigger: do not send to foreign session
  assert.equal(submitted.length, 0, 'Must NOT submit when conversation session ID changed')
  assert.equal(voice.pending.sessionMismatch, true, 'sessionMismatch flag must be raised')
  assert.equal(voice.pending.paused, true, 'Countdown must pause on session mismatch')

  // Now return to original session
  voice.currentSessionId = 'session-A'
  submitPending()

  assert.equal(submitted.length, 1, 'Submission allowed when back in originating session')
  assert.equal(submitted[0], 'Draft A Speech text')
  assert.equal(voice.phase, 'idle')
})

test('Issue #170: keepPending applies active text to composer draft without sending', async () => {
  const { loadedModule } = loadClientInVm()
  const { voice, initPendingPreview, keepPending } = loadedModule._test

  let appliedDraft = ''
  let submittedCount = 0
  const target = {
    initialDraft: 'Prompt:',
    sessionId: 'sess-1',
    actions: {
      setDraft: (val) => { appliedDraft = val },
      submit: () => { submittedCount++ },
    },
  }

  const preview = initPendingPreview('edited text query', target)
  preview.activeText = 'custom manual revision'
  voice.pending = preview
  voice.phase = 'pending'

  keepPending()

  assert.equal(appliedDraft, 'Prompt: custom manual revision')
  assert.equal(submittedCount, 0, 'keepPending must not call submit')
  assert.equal(voice.phase, 'idle')
  assert.equal(voice.pending, null)
})

test('Issue #11, #290: renderEditablePreviewPill renders editIcon and sendIcon without ReferenceError', () => {
  const { loadedModule } = loadClientInVm()
  const { voice, initPendingPreview, renderEditablePreviewPill, editIcon, sendIcon } = loadedModule._test

  assert.equal(typeof editIcon, 'function', 'editIcon must be defined')
  assert.equal(typeof sendIcon, 'function', 'sendIcon must be defined')

  const editEl = editIcon()
  assert.equal(editEl.type, 'svg')
  const sendEl = sendIcon()
  assert.equal(sendEl.type, 'svg')

  const target = {
    initialDraft: '',
    sessionId: 'sess-1',
    actions: { setDraft: () => {}, submit: () => {} },
  }
  const pending = initPendingPreview('Recorded voice message', target, {
    autoSendMs: 4000,
    audioUrl: 'blob:audio-note',
  })
  voice.pending = pending
  voice.settings = { autoSendMs: 4000, autoSendVisualRing: true }

  let isPlaying = false
  const setIsPlaying = (val) => { isPlaying = val }
  const audioRef = { current: { play: async () => {}, pause: () => {}, paused: true } }
  const stateView = { phase: 'pending', settings: voice.settings }

  // Must render without crashing on editIcon() or sendIcon()
  const pillTree = renderEditablePreviewPill(voice, stateView, isPlaying, setIsPlaying, audioRef)
  assert.ok(pillTree, 'Pill element tree must be returned')
  assert.equal(pillTree.type, 'div')

  // Also test when user switches to editing mode
  pending.isEditing = true
  const editingTree = renderEditablePreviewPill(voice, stateView, isPlaying, setIsPlaying, audioRef)
  assert.ok(editingTree, 'Editing pill tree must be returned')
})
