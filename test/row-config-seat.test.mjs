import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const card = readFileSync(new URL('../lib/client-src/73-plugin-card.js', import.meta.url), 'utf8')
const open = readFileSync(new URL('../lib/client-src/00-open.js', import.meta.url), 'utf8')

test('plugins.row.config key is package#row id and the legacy seat stays', () => {
  assert.match(open, /@goodandready\/dsh-voice/)
  assert.match(open, /ROW_CONFIG_KEY = PKG \+ '#' \+ ROW_ID/)
  assert.match(card, /name: 'plugins\.row\.config'/)
  assert.match(card, /key: ROW_CONFIG_KEY/)
  assert.match(card, /name: 'settings\.plugin\.item'/)
  assert.match(card, /view === 'summary'/)
  assert.match(card, /view === 'page'/)
  assert.doesNotMatch(card, /settings\.section/)
})
