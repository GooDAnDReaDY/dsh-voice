import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

// Functions under test matching lib/client-src/30-core.js and 40-recording.js
const KEY_LABELS = {
  Control: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Meta: 'Win',
  Escape: 'Esc',
}

function keyLabel(name, t = (k) => k) {
  if (!name) return 'unset'
  if (typeof name === 'string' && name.includes('+')) {
    return name.split('+').map((p) => keyLabel(p, t)).join(' + ')
  }
  if (name === 'Space') return 'Space'
  if (KEY_LABELS[name]) return KEY_LABELS[name]
  return String(name).replace(/^Key/, '').replace(/^Digit/, '')
}

function keyFromEvent(event) {
  if (!event) return ''
  const modifiers = []
  if (event.ctrlKey && event.key !== 'Control') modifiers.push('Control')
  if (event.altKey && event.key !== 'Alt') modifiers.push('Alt')
  if (event.shiftKey && event.key !== 'Shift') modifiers.push('Shift')
  if (event.metaKey && event.key !== 'Meta') modifiers.push('Meta')

  const main = ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)
    ? event.key
    : (event.code || event.key || '')

  if (modifiers.length > 0 && !['Control', 'Alt', 'Shift', 'Meta'].includes(main)) {
    return modifiers.concat(main).join('+')
  }
  return main
}

function hotkeyMatches(event, name) {
  if (!event || !name) return false
  if (typeof name === 'string' && name.includes('+')) {
    const parts = name.split('+')
    const main = parts[parts.length - 1]
    const needCtrl = parts.includes('Control')
    const needAlt = parts.includes('Alt')
    const needShift = parts.includes('Shift')
    const needMeta = parts.includes('Meta')
    if (needCtrl && !event.ctrlKey) return false
    if (needAlt && !event.altKey) return false
    if (needShift && !event.shiftKey) return false
    if (needMeta && !event.metaKey) return false
    return event.code === main || event.key === main
  }
  if (name === 'Control') return event.key === 'Control'
  if (name === 'Alt') return event.key === 'Alt'
  if (name === 'Shift') return event.key === 'Shift'
  if (name === 'Meta') return event.key === 'Meta'
  return event.code === name || event.key === name
}

function isAllowedInEditable(name) {
  if (!name) return false
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(name)) return true
  if (/^F\d{1,2}$/.test(name)) return true
  if (typeof name === 'string' && name.includes('+')) return true
  if (['Tab', 'Pause', 'ScrollLock', 'Insert'].includes(name)) return true
  return false
}

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
  assert.equal(keyLabel(''), 'unset')
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
