import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMacroPhrase, applyVoiceMacros } from '../lib/macros.js'

test('normalizeMacroPhrase cleans whitespace, casing and punctuation (#167)', () => {
  assert.equal(normalizeMacroPhrase('  Сделай Ревью!  '), 'сделай ревью')
  assert.equal(normalizeMacroPhrase('run tests???'), 'run tests')
  assert.equal(normalizeMacroPhrase(''), '')
  assert.equal(normalizeMacroPhrase(null), '')
})

test('applyVoiceMacros handles empty inputs gracefully (#167)', () => {
  assert.equal(applyVoiceMacros('', []), '')
  assert.equal(applyVoiceMacros('привет', null), 'привет')
  assert.equal(applyVoiceMacros('hello', []), 'hello')
})

test('applyVoiceMacros performs exact matching case-insensitively (#167)', () => {
  const macros = [
    { trigger: 'сделай ревью', template: 'Проведи тщательное код-ревью изменений.' },
    { trigger: 'run tests', template: 'npm test -- --verbose' },
  ]

  assert.equal(
    applyVoiceMacros('Сделай ревью', macros),
    'Проведи тщательное код-ревью изменений.',
  )
  assert.equal(
    applyVoiceMacros('Сделай ревью!', macros),
    'Проведи тщательное код-ревью изменений.',
  )
  assert.equal(
    applyVoiceMacros('RUN TESTS', macros),
    'npm test -- --verbose',
  )
})

test('applyVoiceMacros supports template variable substitution (#167)', () => {
  const macros = [
    { trigger: 'запусти тесты', template: 'Run tests with filter: {text}' },
    { trigger: 'explain', template: 'Explain concept: {{text}} clearly.' },
    { trigger: 'создай issue', template: 'Title: {input}' },
  ]

  assert.equal(
    applyVoiceMacros('запусти тесты для модуля auth', macros),
    'Run tests with filter: для модуля auth',
  )
  assert.equal(
    applyVoiceMacros('explain recursion in javascript', macros),
    'Explain concept: recursion in javascript clearly.',
  )
  assert.equal(
    applyVoiceMacros('создай issue: баг с авторизацией', macros),
    'Title: баг с авторизацией',
  )
})

test('applyVoiceMacros prefix match appends rest when no placeholder present (#167)', () => {
  const macros = [
    { trigger: 'закоммить', template: 'git commit -m' },
  ]
  assert.equal(
    applyVoiceMacros('закоммить фикс авторизации', macros),
    'git commit -m\nфикс авторизации',
  )
})

test('applyVoiceMacros preserves non-matching text (#167)', () => {
  const macros = [
    { trigger: 'сделай ревью', template: 'Review prompt' },
  ]
  assert.equal(
    applyVoiceMacros('обычный текст для диктовки', macros),
    'обычный текст для диктовки',
  )
})

test('Issue #355: applyVoiceMacros slices rest by matched prefix length, not raw trigger length', () => {
  const macros = [
    { trigger: 'review code!', template: 'Prompt: {text}' },
    { trigger: 'запусти   тесты', template: 'Cmd: {text}' },
    { trigger: 'поиск:', template: 'Search for: {{text}}' },
    { trigger: 'create ticket...', template: 'Title: {input}' },
  ]

  // 1. Trigger with punctuation doesn't corrupt rest
  assert.equal(
    applyVoiceMacros('Review Code! check authentication flow', macros),
    'Prompt: check authentication flow',
    'rest must start with first word after trigger without punctuation offset corruption',
  )

  // 2. Trigger with double spaces in config matches single space in spoken text
  assert.equal(
    applyVoiceMacros('Запусти тесты для модуля user', macros),
    'Cmd: для модуля user',
  )

  // 3. Colon punctuation in trigger
  assert.equal(
    applyVoiceMacros('Поиск: где купить билет на самолет', macros),
    'Search for: где купить билет на самолет',
  )

  // 4. Trailing ellipsis in trigger
  assert.equal(
    applyVoiceMacros('Create ticket... broken login button', macros),
    'Title: broken login button',
  )

  // 5. Trigger in middle of sentence must not match
  assert.equal(
    applyVoiceMacros('вчера мы делали review code! и нашли баг', macros),
    'вчера мы делали review code! и нашли баг',
    'must not match trigger in the middle of a sentence',
  )
})
