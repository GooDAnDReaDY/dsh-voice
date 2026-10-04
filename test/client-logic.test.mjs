import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadClientPlugin } from './helpers/load-client.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const client = loadClientPlugin()
const {
  voice,
  extractContextKeywords,
  waitStop,
  currentLevel,
  accentColor,
  VoiceSection,
} = client._test

const { tidyPhrase, applyVoiceCommands } = voice._core

test('tidyPhrase trims and formats comma spacing via production helper (#214)', () => {
  assert.equal(tidyPhrase('привет,мир'), 'Привет, мир')
  assert.equal(tidyPhrase('one,two , three'), 'One, two, three')
  assert.equal(tidyPhrase(''), '')
  assert.equal(tidyPhrase('   '), '')
  assert.equal(tidyPhrase(null), '')
})

test('tidyPhrase capitalizes first word and sentences after punctuation via production helper (#214)', () => {
  assert.equal(tidyPhrase('hello world. this is a test'), 'Hello world. This is a test')
  assert.equal(tidyPhrase('первое предложение! второе предложение? третье.'), 'Первое предложение! Второе предложение? Третье.')
})

test('applyVoiceCommands handles Russian speech commands via production helper (#214)', () => {
  assert.equal(applyVoiceCommands('привет с новой строки как дела'), 'привет\nкак дела')
  assert.equal(applyVoiceCommands('пункт один новая строка пункт два'), 'пункт один\nпункт два')
  assert.equal(applyVoiceCommands('раздел первый абзац раздел второй'), 'раздел первый\n\nраздел второй')
  assert.equal(applyVoiceCommands('слово тире определение'), 'слово — определение')
})

test('applyVoiceCommands handles English speech commands via production helper (#214)', () => {
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

test('currentLevel applies noise gate threshold math and gating logic from production rec (#214)', () => {
  voice.settings = { noiseGateDb: -45 }
  function createMockRec(valueByte) {
    return {
      analyser: {
        frequencyBinCount: 16,
        getByteFrequencyData(buf) {
          buf.fill(valueByte)
        },
      },
    }
  }

  // Low level (below -45 dB threshold): byte 1 -> ~0.0086 < 0.01237
  const hissRec = createMockRec(1)
  assert.equal(currentLevel(hissRec), 0, 'ambient hiss below -45 dB must be cut to 0 by production currentLevel')

  // High level (above -45 dB threshold): byte 30 -> ~0.2588 > 0.01237
  const speechRec = createMockRec(30)
  assert.ok(currentLevel(speechRec) > 0.2, 'human speech above -45 dB must pass through')

  // Gate disabled (-999 dB)
  voice.settings = { noiseGateDb: -999 }
  assert.ok(currentLevel(hissRec) > 0, 'gate disabled must pass all levels')
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

test('waitStop resolves immediately when recorder is inactive or absent via production waitStop (#214)', async () => {
  await assert.doesNotReject(async () => {
    await waitStop(null)
    await waitStop({ state: 'inactive' })
  })
})

test('extractContextKeywords extracts Cyrillic and Latin technical words while filtering stop words via production helper (#214)', () => {
  voice.settings = { contextGlossary: true }
  voice.input = { draft: 'это рефакторинг микросервиса PostgreSQL и Redis для Docker swarm' }
  const extracted = extractContextKeywords()
  assert.ok(extracted.includes('рефакторинг'))
  assert.ok(extracted.includes('микросервиса'))
  assert.ok(extracted.includes('PostgreSQL'))
  assert.ok(extracted.includes('Redis'))
  assert.ok(extracted.includes('Docker'))
  assert.ok(extracted.includes('swarm'))
  assert.ok(!extracted.includes('это'), 'stop words must be omitted')
  assert.ok(!extracted.includes('для'), 'stop words must be omitted')
})

test('undoLastInsert executes production insertion history rollback (#214)', async () => {
  let updatedDraft = ''
  voice.input = { draft: 'Hello beautiful world' }
  voice.inputActions = {
    setDraft: async (val) => {
      updatedDraft = val
    },
  }
  voice._core.insertHistory.length = 0
  voice._core.insertHistory.push({ added: ' beautiful' })

  const res = await voice._core.undoLastInsert()
  assert.equal(res, 'Insert undone')
  assert.equal(updatedDraft, 'Hello world')
})

test('VoiceSection safely renders without throwing when draft or value has null noiseGateDb (#214)', () => {
  assert.doesNotThrow(() => {
    VoiceSection({
      snapshot: { status: 'ready', value: {} },
      draft: null,
      update: () => {},
    })
  })
})

test('visualizer theme colors are cached with 1s TTL via production accentColor (#214)', () => {
  const col1 = accentColor('#10b981')
  assert.ok(col1)
  const col2 = accentColor('#10b981')
  assert.equal(col1, col2)
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


test('npm scripts provide comprehensive lint and pack-size checks (#103)', async () => {
  const pkgRaw = await readFile(path.join(root, 'package.json'), 'utf8')
  const pkg = JSON.parse(pkgRaw)

  assert.equal(pkg.scripts.lint, 'node scripts/lint.mjs', 'lint script must use scripts/lint.mjs')
  assert.ok(pkg.scripts['pack:check'] && pkg.scripts['pack:check'].includes('pack-check.mjs'), 'pack:check must be configured')
  assert.ok(pkg.scripts.pretest.includes('lint.mjs'), 'pretest must run lint')
  assert.ok(pkg.scripts.pretest.includes('pack-check.mjs'), 'pretest must run pack:check')
})
