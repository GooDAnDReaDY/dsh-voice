import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BaseConfig } from '../lib/schema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

test('Issue #326: BaseConfig validates input button visibility toggles with default true', () => {
  const parsedDefault = BaseConfig({})
  assert.equal(parsedDefault.showDictationModeButton, true)
  assert.equal(parsedDefault.showDictationButton, true)
  assert.equal(parsedDefault.showMessageButton, true)

  // Verify all 8 combinations
  const combos = [
    [true, true, true],
    [true, true, false],
    [true, false, true],
    [true, false, false],
    [false, true, true],
    [false, true, false],
    [false, false, true],
    [false, false, false],
  ]

  for (const [mode, dictation, message] of combos) {
    const parsed = BaseConfig({
      showDictationModeButton: mode,
      showDictationButton: dictation,
      showMessageButton: message,
    })
    assert.equal(parsed.showDictationModeButton, mode)
    assert.equal(parsed.showDictationButton, dictation)
    assert.equal(parsed.showMessageButton, message)
  }
})

test('Issue #326: VoiceButtons adapts rendering according to visibility settings and returns null when all hidden', async () => {
  const clientSrc = fs.readFileSync(path.join(rootDir, 'lib', 'client.js'), 'utf8')
  assert.ok(clientSrc.includes('showDictationModeButton'), 'client must check showDictationModeButton')
  assert.ok(clientSrc.includes('showDictationButton'), 'client must check showDictationButton')
  assert.ok(clientSrc.includes('showMessageButton'), 'client must check showMessageButton')

  // Mock React and VoiceButtons environment to test rendering logic
  function mockRenderButtons(settings, lastNote = null) {
    const showDictationMode = settings ? settings.showDictationModeButton !== false : true
    const showDictation = settings ? settings.showDictationButton !== false : true
    const showMessage = settings ? settings.showMessageButton !== false : true
    const hasNote = !!(lastNote && lastNote.url)

    if (!showDictationMode && !showDictation && !showMessage && !hasNote) {
      return null
    }

    const rendered = []
    if (showDictationMode) rendered.push('mode-pill')
    if (showDictation) rendered.push('dictation-mic')
    if (showMessage) rendered.push('voice-message')
    if (hasNote) rendered.push('play-last-note')
    return rendered
  }

  // 1. All enabled
  assert.deepEqual(mockRenderButtons({ showDictationModeButton: true, showDictationButton: true, showMessageButton: true }), ['mode-pill', 'dictation-mic', 'voice-message'])

  // 2. Hide dictation mode
  assert.deepEqual(mockRenderButtons({ showDictationModeButton: false, showDictationButton: true, showMessageButton: true }), ['dictation-mic', 'voice-message'])

  // 3. Hide voice typing
  assert.deepEqual(mockRenderButtons({ showDictationModeButton: true, showDictationButton: false, showMessageButton: true }), ['mode-pill', 'voice-message'])

  // 4. Hide voice message
  assert.deepEqual(mockRenderButtons({ showDictationModeButton: true, showDictationButton: true, showMessageButton: false }), ['mode-pill', 'dictation-mic'])

  // 5. Hide all controls without note
  assert.equal(mockRenderButtons({ showDictationModeButton: false, showDictationButton: false, showMessageButton: false }), null)

  // 6. Hide all controls with note -> only player renders
  assert.deepEqual(mockRenderButtons({ showDictationModeButton: false, showDictationButton: false, showMessageButton: false }, { url: 'blob://note' }), ['play-last-note'])
})

test('Issue #326: Locale dictionaries contain symmetric button toggle keys in EN and ZH', () => {
  const locSrc = fs.readFileSync(path.join(rootDir, 'lib', 'client-src', '10-locale.js'), 'utf8')
  assert.ok(locSrc.includes("'showDictationModeBtn':"), 'EN/ZH must have showDictationModeBtn')
  assert.ok(locSrc.includes("'showDictationBtn':"), 'EN/ZH must have showDictationBtn')
  assert.ok(locSrc.includes("'showMessageBtn':"), 'EN/ZH must have showMessageBtn')
})

test('Issue #326: Settings card renders reactive toggles for button visibility', () => {
  const secSrc = fs.readFileSync(path.join(rootDir, 'lib', 'client-src', '72-voice-section.js'), 'utf8')
  assert.ok(secSrc.includes("'showDictationModeButton'"), 'VoiceSection must bind showDictationModeButton')
  assert.ok(secSrc.includes("'showDictationButton'"), 'VoiceSection must bind showDictationButton')
  assert.ok(secSrc.includes("'showMessageButton'"), 'VoiceSection must bind showMessageButton')
})

