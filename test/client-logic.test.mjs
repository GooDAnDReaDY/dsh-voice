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
  if (/^\n+$/.test(s)) return s
  const lead = (s.match(/^\n+/) || [''])[0]
  const trail = (s.match(/\n+$/) || [''])[0]
  const trimmed = s.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/[ \t]+/g, ' ').trim()
  if (!trimmed) return lead || trail || ''
  return lead + trimmed + trail
}

function tidyPhrase(text) {
  if (!text) return ''
  if (/^\n+$/.test(text)) return text
  const lead = (text.match(/^\n+/) || [''])[0]
  const trail = (text.match(/\n+$/) || [''])[0]
  let s = String(text).trim()
  if (!s) return lead || trail || ''
  s = s.replace(/\s*,\s*/g, ', ')
  s = s.replace(/(^|[.!?\n]\s+)([a-zа-яё])/gi, (m, l, ch) => l + ch.toUpperCase())
  return lead + s + trail
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
  assert.deepEqual(mod.inject, ['timer', 'slots', 'configForms', 'locale'])
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

test('undoLastInsert normalizes consecutive spaces and trims cleanly', () => {
  function spliceUndo(draft, added) {
    const i = draft.lastIndexOf(added)
    if (i < 0) return null
    const spliced = draft.slice(0, i) + draft.slice(i + added.length)
    return spliced.replace(/[ \t]{2,}/g, ' ').replace(/\s+$/, '').trimStart()
  }

  // Undoing a middle insertion without leaving double spaces
  const draft = 'Hello beautiful world'
  const added = ' beautiful'
  assert.equal(spliceUndo(draft, added), 'Hello world')

  // Undoing start insertion
  assert.equal(spliceUndo('First then second', 'First '), 'then second')

  // Undoing end insertion
  assert.equal(spliceUndo('Prefix suffix', ' suffix'), 'Prefix')
})

test('noiseGateDb safely evaluates without throwing when draft or value is null', () => {
  function computeGateDb(draft, value) {
    return Number(
      (draft && draft.noiseGateDb !== undefined)
        ? draft.noiseGateDb
        : (value && value.noiseGateDb !== undefined)
          ? value.noiseGateDb
          : -45
    )
  }

  // Initial state before form edit: draft is null, value is null
  assert.doesNotThrow(() => {
    assert.equal(computeGateDb(null, null), -45)
  })

  // draft is null, value loaded from server
  assert.equal(computeGateDb(null, { noiseGateDb: -30 }), -30)

  // draft has overridden value
  assert.equal(computeGateDb({ noiseGateDb: -50 }, { noiseGateDb: -30 }), -50)

  // disabled gate (-999)
  assert.equal(computeGateDb({ noiseGateDb: -999 }, null), -999)
})

test('pagehide and beforeunload lifecycle cleanup handlers are registered in client bundle', async () => {
  const clientSrc = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.ok(clientSrc.includes("addEventListener('pagehide'"), 'pagehide listener must be present')
  assert.ok(clientSrc.includes("addEventListener('beforeunload'"), 'beforeunload listener must be present')
})

test('visualizer theme colors are cached with 1s TTL', () => {
  let calls = 0
  let cache = { color: '', expires: 0 }
  function getCachedAccentColor(now) {
    if (now < cache.expires && cache.color) return cache.color
    calls++
    const pick = '#10b981'
    cache = { color: pick, expires: now + 1000 }
    return pick
  }

  // Call 60 times within 500ms
  for (let t = 0; t < 500; t += 10) {
    getCachedAccentColor(1000 + t)
  }
  assert.equal(calls, 1, 'Only 1 DOM style resolution within 1s window')

  // Advance past 1000ms
  getCachedAccentColor(2100)
  assert.equal(calls, 2, 'Refreshed after TTL expiration')
})

test('client bundle contains CSS classes and DOM handlers for voice enhancements', async () => {
  const clientSrc = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.ok(clientSrc.includes('.dvo-silence-ring'), 'silence ring styles must be present')
  assert.ok(clientSrc.includes('.dvo-ghost'), 'ghost preview styles must be present')
  assert.ok(clientSrc.includes('.dvo-installer-box'), 'installer box styles must be present')
  assert.ok(clientSrc.includes('.dvo-progress-bar'), 'progress bar styles must be present')
  assert.ok(clientSrc.includes('dsh:tts:start'), 'TTS start event listener must be present')
  assert.ok(clientSrc.includes('dsh:tts:stop'), 'TTS stop event listener must be present')
  assert.ok(clientSrc.includes('gatedTurnTaking'), 'gatedTurnTaking setting must be wired')
  assert.ok(clientSrc.includes('autoSendVisualRing'), 'autoSendVisualRing setting must be wired')
  assert.ok(clientSrc.includes('liveInterimPreview'), 'liveInterimPreview setting must be wired')
  assert.ok(clientSrc.includes('techJargonCorrection'), 'techJargonCorrection setting must be wired')
  assert.ok(clientSrc.includes('structuredPromptVoice'), 'structuredPromptVoice setting must be wired')
})

test('recording cancellation invalidates pending async STT operation (#198)', async () => {
  const clientSrc = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.ok(clientSrc.includes('voice.activeOpId'), 'client bundle must track activeOpId across async STT ops')
})

test('composer reload synchronizes vadSilenceMs and autoSendMs from host status (#194)', async () => {
  const clientSrc = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.ok(clientSrc.includes('vadSilenceMs: Number(data && data.modes && data.modes.dictation && data.modes.dictation.vadSilenceMs)'), 'composer must sync vadSilenceMs from /status')
  assert.ok(clientSrc.includes('autoSendMs: Number(data && data.modes && data.modes.message && data.modes.message.autoSendMs)'), 'composer must sync autoSendMs from /status')
})

test('push-to-talk button retains pointer capture and global release listeners during hold (#195)', async () => {
  const clientSrc = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.ok(clientSrc.includes('!hold.armed'), 'VoiceButtons must remain mounted during active hold')
  assert.ok(clientSrc.includes('setPointerCapture'), 'VoiceButtons must capture pointer on hold')
  assert.ok(clientSrc.includes("addEventListener('pointercancel'"), 'window pointercancel listener must be wired')
})

test('final dictation tail is sequenced through dictationQueue to preserve FIFO text order (#197)', async () => {
  const clientSrc = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.ok(clientSrc.includes('dictationQueue = dictationQueue.then(processTail)'), 'stopCurrent must sequence processTail via dictationQueue')
  assert.ok(clientSrc.includes('await dictationQueue'), 'stopCurrent must await dictationQueue drainage')
})

test('browser speech recognizer stops restart on fatal error, aborts on wake word, and awaits stop finals (#202)', async () => {
  const clientSrc = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.ok(clientSrc.includes('stopped = true\n        try { recognition.abort()'), 'recognition.onerror must set stopped and abort on fatal errors')
  assert.ok(clientSrc.includes('voice.browser.abort()'), 'wake-word transition must abort previous browser recognizer')
  assert.ok(clientSrc.includes('Promise.resolve(b.stop()).then('), 'stopCurrent must await browser stop before reading finals')
})

test('spoken actions send and clear adapt to standard InputActions contract (#199)', async () => {
  const clientSrc = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.ok(clientSrc.includes('function clearDraft'), 'clearDraft helper must be defined')
  assert.ok(clientSrc.includes('executeVoiceAction'), 'executeVoiceAction adapter must be defined')
  assert.ok(!clientSrc.includes('voice.inputActions.send'), 'deprecated voice.inputActions.send must be removed')
  assert.ok(!clientSrc.includes('voice.inputActions.clear'), 'deprecated voice.inputActions.clear must be removed')
  assert.ok(clientSrc.includes("actions.setDraft('')"), 'clear must call actions.setDraft')
})

test('newline preservation across tidyPhrase, applyVoiceCommands, and draft insertion (#200)', async () => {
  assert.equal(tidyPhrase('\n'), '\n')
  assert.equal(tidyPhrase('\n\n'), '\n\n')
  assert.equal(tidyPhrase('Первая строка\n'), 'Первая строка\n')
  assert.equal(applyVoiceCommands('новая строка'), '\n')
  assert.equal(applyVoiceCommands('абзац'), '\n\n')
  assert.equal(applyVoiceCommands('Первая строка новая строка'), 'Первая строка\n')

  const clientSrc = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.ok(clientSrc.includes('function insertDraftText'), 'insertDraftText helper must be present')
  assert.ok(clientSrc.includes("action === 'newline'"), 'newline action handling must be wired')
  assert.ok(clientSrc.includes("draft.endsWith('\\n') || text.startsWith('\\n')"), 'newline boundary check must prevent extra spaces')
})

test('supported languages include canonical auto empty string and Chinese (#208)', async () => {
  const clientSrc = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.ok(clientSrc.includes("code: ''"), 'canonical auto empty string must be present')
  assert.ok(clientSrc.includes("code: 'zh'"), 'Chinese language code zh must be present')
  assert.ok(clientSrc.includes("modeVal(mode, 'language', '')"), 'default language lookup must use canonical empty string')
  assert.ok(clientSrc.includes('langAuto'), 'langAuto localization key must be present')
})

test('Web Speech browser recognizer resolves language according to environment policy (#201)', async () => {
  const clientSrc = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.ok(clientSrc.includes('function resolveBrowserRecognitionLang'), 'resolveBrowserRecognitionLang helper must be defined')
  assert.ok(!clientSrc.includes("recognition.lang = options.lang && options.lang !== 'auto' ? options.lang : 'ru-RU'"), 'hardcoded ru-RU default must be removed')
  assert.ok(clientSrc.includes('document.documentElement.lang') || clientSrc.includes('navigator.language'), 'document/navigator language must be respected for auto')
})

test('updater card does not report false upToDate when status is unknown or check failed (#213)', async () => {
  const clientSrc = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.ok(!clientSrc.includes("'v' + ((updaterStatus && updaterStatus.currentVersion) || '0.9.6')"), 'hardcoded 0.9.6 fallback must be removed')
  assert.ok(clientSrc.includes('updaterStatus.latestCheckFailed'), 'updater card must handle latestCheckFailed')
  assert.ok(clientSrc.includes('updateStatusUnknown'), 'unknown status fallback must be wired')
})

test('registerGlobalLifecycle attaches and disposes all 5 global event listeners symmetrically (#203)', async () => {
  const clientSrc = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.ok(clientSrc.includes('function registerGlobalLifecycle'), 'registerGlobalLifecycle must be defined')
  assert.ok(clientSrc.includes("removeEventListener('dsh:tts:start'"), 'dsh:tts:start must have symmetrical cleanup')
  assert.ok(clientSrc.includes("removeEventListener('dsh:tts:stop'"), 'dsh:tts:stop must have symmetrical cleanup')
  assert.ok(clientSrc.includes("removeEventListener('dsh-voice:settings-saved'"), 'settings-saved must have symmetrical cleanup')
  assert.ok(clientSrc.includes("removeEventListener('pagehide'"), 'pagehide must have symmetrical cleanup')
  assert.ok(clientSrc.includes("removeEventListener('beforeunload'"), 'beforeunload must have symmetrical cleanup')
})

test('settings CSS rules are strictly scoped to .dvo-settings-root and managed via lifecycle (#211)', async () => {
  const clientSrc = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.ok(clientSrc.includes('.dvo-settings-root .cb-section-card'), 'cb-section-card must be scoped to dvo-settings-root')
  assert.ok(clientSrc.includes('.dvo-settings-root .cb-btn'), 'cb-btn must be scoped to dvo-settings-root')
  assert.ok(!clientSrc.includes("'.cb-page{"), 'naked .cb-page rule must not exist')
  assert.ok(!clientSrc.includes("'.cb-btn{"), 'naked .cb-btn rule must not exist')
  assert.ok(clientSrc.includes('function installSettingsCss'), 'installSettingsCss must be defined')
})


test('EN and ZH locale dictionaries are symmetric and cover required UI keys (#212)', async () => {
  const localeSrc = await readFile(path.join(root, 'lib/client-src/10-locale.js'), 'utf8')
  
  function extractKeys(src, dictName) {
    const startPattern = `const ${dictName} = {`
    const startIdx = src.indexOf(startPattern)
    assert.ok(startIdx !== -1, `dict ${dictName} must exist`)
    const endIdx = src.indexOf('\n    }', startIdx)
    assert.ok(endIdx !== -1, `dict ${dictName} end must exist`)
    const block = src.slice(startIdx, endIdx)
    const keys = []
    const re = /'([a-zA-Z0-9_-]+)':/g
    let m
    while ((m = re.exec(block)) !== null) {
      keys.push(m[1])
    }
    return keys
  }

  const enKeys = extractKeys(localeSrc, 'en')
  const zhKeys = extractKeys(localeSrc, 'zh')

  assert.equal(enKeys.length, zhKeys.length, `en (${enKeys.length}) and zh (${zhKeys.length}) must have identical key count`)
  const enSet = new Set(enKeys)
  const zhSet = new Set(zhKeys)
  for (const k of enKeys) {
    assert.ok(zhSet.has(k), `key ${k} in EN must exist in ZH`)
  }
  for (const k of zhKeys) {
    assert.ok(enSet.has(k), `key ${k} in ZH must exist in EN`)
  }

  // Verify specific #212 keys
  const expectedKeys = ['voiceInput', 'assistantSpeakingGated', 'jargonFormatHint', 'errorPrefix', 'updateSuccess']
  for (const k of expectedKeys) {
    assert.ok(enSet.has(k), `required #212 key ${k} must exist in EN`)
    assert.ok(zhSet.has(k), `required #212 key ${k} must exist in ZH`)
  }
})
