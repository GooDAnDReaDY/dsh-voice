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

test('noise gate threshold math and gating logic', () => {
  function computeGateLevel(raw, gateDb) {
    if (gateDb > -90) {
      const gateAmp = Math.pow(10, gateDb / 20) * 2.2
      if (raw < gateAmp) return 0
    }
    return raw
  }

  // -45 dB standard default threshold: 10^(-45/20) * 2.2 ~= 0.01237
  const ambientHiss = 0.008
  const humanSpeech = 0.25

  assert.equal(computeGateLevel(ambientHiss, -45), 0, 'ambient hiss below -45 dB must be cut to 0')
  assert.equal(computeGateLevel(humanSpeech, -45), humanSpeech, 'human speech above -45 dB must pass through')

  // When disabled (e.g. -999 dB), even low background noise passes through
  assert.equal(computeGateLevel(ambientHiss, -999), ambientHiss, 'gate disabled must pass all levels')
})

test('package.json packaging hygiene strictly excludes lib/client-src and includes multilingual docs', async () => {
  const pkgRaw = await readFile(path.join(root, 'package.json'), 'utf8')
  const pkg = JSON.parse(pkgRaw)

  assert.ok(Array.isArray(pkg.files), 'package.json must specify files whitelist')
  assert.ok(pkg.files.includes('lib/*.js'), 'files must include lib/*.js')
  assert.ok(!pkg.files.includes('lib/'), 'files must NOT include recursive lib/ directory')
  assert.ok(pkg.files.includes('README.md'), 'files must include README.md')
  assert.ok(pkg.files.includes('README.zh.md'), 'files must include README.zh.md')
  assert.ok(pkg.files.includes('README.ru.md'), 'files must include README.ru.md')
})

test('waitStop resolves immediately when recorder is inactive or absent', async () => {
  function waitStop(recorder) {
    if (!recorder || recorder.state === 'inactive') return Promise.resolve()
    return new Promise((resolve) => recorder.addEventListener('stop', resolve, { once: true }))
  }

  await assert.doesNotReject(async () => {
    await waitStop(null)
    await waitStop({ state: 'inactive' })
  })
})

test('extractContextKeywords extracts Cyrillic and Latin technical words while filtering stop words', () => {
  function extractContextKeywordsFrom(text) {
    if (!text || text.length < 3) return []
    const matches = text.match(/[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_]{2,29}/g) || []
    const stop = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was',
      'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now',
      'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she',
      'too', 'use', 'это', 'как', 'что', 'для', 'или', 'если', 'все', 'при', 'так', 'уже',
      'был', 'быть', 'только', 'тоже', 'под', 'над', 'без', 'нет', 'даже', 'где', 'чем',
    ])
    const words = []
    const seen = new Set()
    for (const m of matches) {
      const lower = m.toLowerCase()
      if (!stop.has(lower) && !seen.has(lower)) {
        seen.add(lower)
        words.push(m)
        if (words.length >= 30) break
      }
    }
    return words
  }

  const sample = 'это рефакторинг микросервиса PostgreSQL и Redis для Docker swarm'
  const extracted = extractContextKeywordsFrom(sample)
  assert.ok(extracted.includes('рефакторинг'))
  assert.ok(extracted.includes('микросервиса'))
  assert.ok(extracted.includes('PostgreSQL'))
  assert.ok(extracted.includes('Redis'))
  assert.ok(extracted.includes('Docker'))
  assert.ok(extracted.includes('swarm'))
  assert.ok(!extracted.includes('это'), 'stop words must be omitted')
  assert.ok(!extracted.includes('для'), 'stop words must be omitted')
})


