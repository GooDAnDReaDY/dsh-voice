import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

// Pure client logic helpers under test matching lib/client-src/30-core.js
const VOICE_COMMANDS = [
  [/(^|[\s,.!?])с новой строки([\s,.!?]|$)/gi, '$1\n$2'],
  [/(^|[\s,.!?])новая строка([\s,.!?]|$)/gi, '$1\n$2'],
  [/(^|[\s,.!?])абзац([\s,.!?]|$)/gi, '$1\n\n$2'],
  [/(^|\s)тире(\s|$)/gi, '$1—$2'],
  [/(^|[\s,.!?])new line([\s,.!?]|$)/gi, '$1\n$2'],
  [/(^|[\s,.!?])paragraph([\s,.!?]|$)/gi, '$1\n\n$2'],
]

function applyVoiceCommands(text) {
  let s = text
  for (const [re, to] of VOICE_COMMANDS) s = s.replace(re, to)
  return s.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/[ \t]+/g, ' ').trim()
}

function tidyPhrase(text) {
  let s = String(text || '').trim()
  if (!s) return s
  s = s.replace(/\s*,\s*/g, ', ')
  s = s.replace(/(^|[.!?\n]\s+)([a-zа-яё])/gi, (m, lead, ch) => lead + ch.toUpperCase())
  return s
}

test('tidyPhrase trims and formats comma spacing', () => {
  assert.equal(tidyPhrase('привет,мир'), 'Привет, мир')
  assert.equal(tidyPhrase('one,two , three'), 'One, two, three')
  assert.equal(tidyPhrase(''), '')
  assert.equal(tidyPhrase('   '), '')
  assert.equal(tidyPhrase(null), '')
})

test('tidyPhrase capitalizes first word and sentences after punctuation', () => {
  assert.equal(tidyPhrase('hello world. this is a test'), 'Hello world. This is a test')
  assert.equal(tidyPhrase('первое предложение! второе предложение? третье.'), 'Первое предложение! Второе предложение? Третье.')
})

test('applyVoiceCommands handles Russian speech commands', () => {
  assert.equal(applyVoiceCommands('привет с новой строки как дела'), 'привет\nкак дела')
  assert.equal(applyVoiceCommands('пункт один новая строка пункт два'), 'пункт один\nпункт два')
  assert.equal(applyVoiceCommands('раздел первый абзац раздел второй'), 'раздел первый\n\nраздел второй')
  assert.equal(applyVoiceCommands('слово тире определение'), 'слово — определение')
})

test('applyVoiceCommands handles English speech commands', () => {
  assert.equal(applyVoiceCommands('hello new line world'), 'hello\nworld')
  assert.equal(applyVoiceCommands('section one paragraph section two'), 'section one\n\nsection two')
})

test('CSS rules in lib/client-src/20-css.js enforce touch-action, user-select and HiDPI', async () => {
  const cssFile = await readFile(path.join(root, 'lib/client-src/20-css.js'), 'utf8')
  assert.ok(cssFile.includes('user-select:none'), 'pill and buttons must have user-select:none')
  assert.ok(cssFile.includes('touch-action:manipulation'), 'buttons must have touch-action:manipulation')
  assert.ok(cssFile.includes('min-width:0'), 'canvas must have min-width:0')
  assert.ok(cssFile.includes('.dvo-mic-test'), 'mic test styles must be defined')
  assert.ok(cssFile.includes('.dvo-meter-bar'), 'mic meter bar styles must be defined')
})

test('client bundle lib/client.js builds and loads into ModuleLoader cleanly', async () => {
  const clientSrc = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  let registered = null
  const mockDoc = {
    querySelector: () => null,
    createElement: () => ({ setAttribute() {}, dataset: {} }),
    head: { appendChild() {} },
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  const mockWindow = {
    __ModuleLoader__: {
      load(spec) {
        registered = spec
      },
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  const fn = new Function('window', 'document', 'navigator', clientSrc)
  fn(mockWindow, mockDoc, { mediaDevices: {} })
  assert.ok(registered, 'window.__ModuleLoader__.load was called')
  assert.equal(registered.id, '@goodandready/dsh-voice')
  assert.equal(typeof registered.factory, 'function')

  const mod = registered.factory(() => ({
    createElement: () => ({}),
    useReducer: () => [0, () => {}],
    useRef: () => ({ current: null }),
    useEffect: () => {},
    useState: (init) => [init, () => {}],
    useCallback: (fn) => fn,
    Fragment: 'Fragment',
  }))
  assert.ok(mod)
  assert.equal(typeof mod.apply, 'function')
  assert.deepEqual(mod.inject, ['timer', 'slots', 'settingsScope', 'locale'])
})
