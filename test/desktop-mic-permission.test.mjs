import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { loadClientPlugin } from './helpers/load-client.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientBundlePath = path.join(__dirname, '..', 'lib', 'client.js')
const clientCode = fs.readFileSync(clientBundlePath, 'utf8')

function loadClientWithNav(navigatorMock) {
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
    useRef(init) { return { current: init } },
    useEffect() {},
    useMemo(fn) { return fn() },
    createElement(type, props, ...children) {
      return { type, props: props || {}, children }
    },
  }

  const sandbox = {
    window: {
      __ModuleLoader__: {
        load({ id, factory }) {
          loadedModule = factory((name) => (name === 'react' ? mockReact : {}))
        },
      },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {},
      location: { protocol: navigatorMock.protocol || 'http:', hostname: 'localhost' },
      isSecureContext: true,
    },
    navigator: navigatorMock,
    document: {
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ setAttribute() {}, appendChild() {}, style: {}, dataset: {} }),
      head: { appendChild() {} },
    },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
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
  return { module: loadedModule, hookStates }
}

test('locale dictionaries define Windows & desktop microphone permission hints (#15, #300)', () => {
  const client = loadClientPlugin()
  const enRegistered = {}
  const zhRegistered = {}
  client.apply({
    locale: {
      register: (ns, lang, dict) => {
        if (lang === 'en') Object.assign(enRegistered, dict)
        if (lang === 'zh') Object.assign(zhRegistered, dict)
      },
      bind: () => (k) => k,
    },
    slots: { inject: () => () => {}, register: () => {} },
    configForms: {},
    effect: (fn) => fn(),
  })

  assert.ok(enRegistered.wizardHintWinDesktop, 'en wizardHintWinDesktop must be defined')
  assert.ok(enRegistered.wizardHintWinBrowser, 'en wizardHintWinBrowser must be defined')
  assert.ok(enRegistered.wizardHintMacDesktop, 'en wizardHintMacDesktop must be defined')
  assert.ok(enRegistered.wizardOpenWinMicSettings, 'en wizardOpenWinMicSettings must be defined')

  assert.ok(zhRegistered.wizardHintWinDesktop, 'zh wizardHintWinDesktop must be defined')
  assert.ok(zhRegistered.wizardHintWinBrowser, 'zh wizardHintWinBrowser must be defined')
  assert.ok(zhRegistered.wizardHintMacDesktop, 'zh wizardHintMacDesktop must be defined')
  assert.ok(zhRegistered.wizardOpenWinMicSettings, 'zh wizardOpenWinMicSettings must be defined')

  // Zero Cyrillic in English and Chinese dictionaries
  const cyrillicRegex = /[\u0400-\u04FF]/
  assert.ok(!cyrillicRegex.test(enRegistered.wizardHintWinDesktop))
  assert.ok(!cyrillicRegex.test(zhRegistered.wizardHintWinDesktop))
})

test('FirstRunWizard renders ms-settings:privacy-microphone on Windows when permission denied (#15, #300)', () => {
  const { module, hookStates } = loadClientWithNav({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) @deepseek-ai/dsh-desktop/0.2.1',
    platform: 'Win32',
    mediaDevices: { getUserMedia: () => {} },
  })

  const FirstRunWizard = module._test.FirstRunWizard
  assert.ok(typeof FirstRunWizard === 'function', 'FirstRunWizard must be exported in _test')

  // Set micPermission hook state (index 0) to 'denied'
  hookStates[0] = 'denied'

  const vdom = FirstRunWizard({
    t: (k) => k,
    draft: {},
    setTop: () => {},
  })

  // Verify that an anchor element targeting ms-settings:privacy-microphone is present in VDOM
  const findAnchors = (node) => {
    const res = []
    if (!node || typeof node !== 'object') return res
    if (node.type === 'a' && node.props && node.props.href === 'ms-settings:privacy-microphone') {
      res.push(node)
    }
    const children = Array.isArray(node.children) ? node.children : []
    for (const child of children) {
      res.push(...findAnchors(child))
    }
    return res
  }

  const anchors = findAnchors(vdom)
  assert.ok(anchors.length >= 1, 'must render ms-settings:privacy-microphone link when on Windows and permission denied')
})
