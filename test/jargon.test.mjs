import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyJargonDictionary, DEFAULT_JARGON_DICTIONARY, normalizePhrase } from '../lib/normalize.js'

test('DEFAULT_JARGON_DICTIONARY has essential developer terms', () => {
  assert.ok(DEFAULT_JARGON_DICTIONARY.length >= 20)
  assert.ok(DEFAULT_JARGON_DICTIONARY.some(item => item.from === 'гитхаб' && item.to === 'GitHub'))
  assert.ok(DEFAULT_JARGON_DICTIONARY.some(item => item.from === 'дш' && item.to === 'DSH'))
  assert.ok(DEFAULT_JARGON_DICTIONARY.some(item => item.from === 'докер' && item.to === 'Docker'))
  assert.ok(DEFAULT_JARGON_DICTIONARY.some(item => item.from === 'пнпм' && item.to === 'pnpm'))
})

test('applyJargonDictionary replaces developer slang and preserves surrounding text', () => {
  const input = 'запушь этот коммит на гитхаб и запусти пайплайн в докер'
  const expected = 'запушь этот commit на GitHub и запусти pipeline в Docker'
  assert.equal(applyJargonDictionary(input), expected)
})

test('applyJargonDictionary respects word boundaries and does not corrupt substrings', () => {
  const input = 'докер-контейнер и кубернетис работают отлично'
  const expected = 'Docker-контейнер и Kubernetes работают отлично'
  assert.equal(applyJargonDictionary(input), expected)
})

test('applyJargonDictionary supports custom replacements', () => {
  const custom = [{ from: 'суперпроект', to: 'SuperProject' }]
  const input = 'собери суперпроект через пнпм'
  const expected = 'собери SuperProject через pnpm'
  assert.equal(applyJargonDictionary(input, custom), expected)
})

test('normalizePhrase applies jargon normalization when requested', () => {
  const input = 'сделай пулл реквест на гитхаб'
  const res = normalizePhrase(input, { jargon: true, trailingPeriod: true })
  assert.equal(res, 'сделай PR на GitHub.')
})

test('applyJargonDictionary repeats the same phrase without a stuck global regex', () => {
  const input = 'запушь этот коммит на гитхаб и запусти пайплайн в докер'
  const expected = 'запушь этот commit на GitHub и запусти pipeline в Docker'
  assert.equal(applyJargonDictionary(input), expected)
  assert.equal(applyJargonDictionary(input), expected)
})
