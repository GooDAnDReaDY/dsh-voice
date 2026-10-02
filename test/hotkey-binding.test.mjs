import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

import { loadClientPlugin } from './helpers/load-client.mjs'

const client = loadClientPlugin()
const {
  keyLabel,
  keyFromEvent,
  hotkeyMatches,
  isAllowedInEditable,
  isHotkeyRelease,
} = client._test

test('keyFromEvent detects single modifiers and standard keys', () => {
  assert.equal(keyFromEvent({ key: 'Control', ctrlKey: true }), 'Control')
  assert.equal(keyFromEvent({ key: 'Alt', altKey: true }), 'Alt')
  assert.equal(keyFromEvent({ key: 'Shift', shiftKey: true }), 'Shift')
  assert.equal(keyFromEvent({ key: 'Tab', code: 'Tab' }), 'Tab')
  assert.equal(keyFromEvent({ key: 'F2', code: 'F2' }), 'F2')
  assert.equal(keyFromEvent({ key: ' ', code: 'Space' }), 'Space')
})

test('keyFromEvent detects modifier combinations', () => {
  assert.equal(keyFromEvent({ key: ' ', code: 'Space', ctrlKey: true }), 'Control+Space')
  assert.equal(keyFromEvent({ key: 'v', code: 'KeyV', altKey: true }), 'Alt+KeyV')
  assert.equal(keyFromEvent({ key: 'r', code: 'KeyR', ctrlKey: true, shiftKey: true }), 'Control+Shift+KeyR')
})

test('keyLabel formats combos and standard keys cleanly', () => {
  assert.equal(keyLabel('Control'), 'Ctrl')
  assert.equal(keyLabel('Control+Space'), 'Ctrl + Space')
  assert.equal(keyLabel('Alt+KeyV'), 'Alt + V')
  assert.equal(keyLabel('Tab'), 'Tab')
  assert.equal(keyLabel('F5'), 'F5')
  assert.equal(keyLabel(''), 'not set')
})

test('hotkeyMatches matches single keys and combos', () => {
  // Single keys
  assert.equal(hotkeyMatches({ key: 'Control' }, 'Control'), true)
  assert.equal(hotkeyMatches({ key: 'Alt' }, 'Control'), false)
  assert.equal(hotkeyMatches({ code: 'Tab', key: 'Tab' }, 'Tab'), true)
  assert.equal(hotkeyMatches({ code: 'KeyV', key: 'v' }, 'KeyV'), true)

  // Combos
  assert.equal(hotkeyMatches({ code: 'Space', key: ' ', ctrlKey: true }, 'Control+Space'), true)
  assert.equal(hotkeyMatches({ code: 'Space', key: ' ', ctrlKey: false }, 'Control+Space'), false)
  assert.equal(hotkeyMatches({ code: 'KeyV', key: 'v', altKey: true }, 'Alt+KeyV'), true)
  assert.equal(hotkeyMatches({ code: 'KeyV', key: 'v', altKey: false }, 'Alt+KeyV'), false)
})

test('isAllowedInEditable allows non-typing hotkeys in textareas and blocks plain letters', () => {
  assert.equal(isAllowedInEditable('Control'), true)
  assert.equal(isAllowedInEditable('Alt'), true)
  assert.equal(isAllowedInEditable('Shift'), true)
  assert.equal(isAllowedInEditable('F1'), true)
  assert.equal(isAllowedInEditable('F12'), true)
  assert.equal(isAllowedInEditable('Control+Space'), true)
  assert.equal(isAllowedInEditable('Alt+KeyV'), true)
  assert.equal(isAllowedInEditable('Tab'), true)

  // Plain characters must be blocked in editable elements so typing isn't hijacked
  assert.equal(isAllowedInEditable('KeyA'), false)
  assert.equal(isAllowedInEditable('KeyR'), false)
  assert.equal(isAllowedInEditable('Digit1'), false)
})

test('lib/client.js contains global hotkey cleanup and preventDefault logic (#171)', async () => {
  const content = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.ok(content.includes('clearGlobalHotkey'), 'must contain clearGlobalHotkey')
  assert.ok(content.includes('__dsh_voice_hotkey_cleanup'), 'must register window.__dsh_voice_hotkey_cleanup')
  assert.ok(content.includes('isAllowedInEditable'), 'must check isAllowedInEditable')
  assert.ok(content.includes('event.preventDefault()'), 'must call event.preventDefault() on hotkey activation')
})

// isHotkeyRelease imported from client._test

test('isHotkeyRelease detects release when modifier is released first (#196)', () => {
  // Ctrl+Space combination: releasing Ctrl first
  assert.equal(isHotkeyRelease({ key: 'Control' }, 'Control+Space'), true)
  // Releasing Space first
  assert.equal(isHotkeyRelease({ code: 'Space', key: ' ' }, 'Control+Space'), true)
  // Irrelevant key up does not match
  assert.equal(isHotkeyRelease({ key: 'Shift' }, 'Control+Space'), false)

  // Alt+KeyV combination: releasing Alt first
  assert.equal(isHotkeyRelease({ key: 'Alt' }, 'Alt+KeyV'), true)
  assert.equal(isHotkeyRelease({ code: 'KeyV' }, 'Alt+KeyV'), true)

  // Single key hotkey
  assert.equal(isHotkeyRelease({ code: 'F8' }, 'F8'), true)
})

test('lib/client.js includes isHotkeyRelease helper for combo keyup (#196)', async () => {
  const content = await readFile(path.join(root, 'lib/client.js'), 'utf8')
  assert.ok(content.includes('isHotkeyRelease'), 'must contain isHotkeyRelease helper')
})
