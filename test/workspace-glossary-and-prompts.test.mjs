import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_DICTATION_MODES,
  DICTATION_MODES,
  DEFAULT_DICTATION_PROMPTS,
  resolveDictationPrompt,
} from '../lib/dictation-modes.js'
import { applyCodeCasing, cleanFillerWords, normalizePhrase } from '../lib/normalize.js'
import { BaseConfig } from '../lib/schema.js'
import { DEFAULT_BILINGUAL_PROMPT, buildTranscriptionPrompt } from '../lib/transcribe-core.js'

test('Issue #320: ALL_DICTATION_MODES includes bug report mode while preserving DICTATION_MODES compatibility', () => {
  assert.deepEqual(DICTATION_MODES, ['verbatim', 'clean', 'task', 'note'])
  assert.ok(ALL_DICTATION_MODES.includes('bug'))
  assert.deepEqual(ALL_DICTATION_MODES, ['verbatim', 'clean', 'task', 'note', 'bug'])
})

test('Issue #320, #321: resolveDictationPrompt supports bug report mode with structured triage fields', () => {
  const prompt = resolveDictationPrompt('bug', {}, 'падают тесты при сборке бандла')
  assert.ok(prompt.includes('Problem Summary'))
  assert.ok(prompt.includes('Steps to Reproduce'))
  assert.ok(prompt.includes('Expected Behavior'))
  assert.ok(prompt.includes('Observed Behavior'))
  assert.ok(prompt.includes('падают тесты при сборке бандла'))
})

test('Issue #320, #321: BaseConfig validates bug dictationMode and custom bug prompt', () => {
  const valid = BaseConfig({
    dictationMode: 'bug',
    dictationPrompts: {
      bug: 'Custom bug prompt for {text}',
    },
  })
  assert.equal(valid.dictationMode, 'bug')
  assert.equal(valid.dictationPrompts.bug, 'Custom bug prompt for {text}')
})

test('Issue #320: applyCodeCasing converts dev phrases to camelCase, snake_case, PascalCase, CONSTANT_CASE, and kebab-case', () => {
  // camelCase with explicit keyword
  assert.equal(
    applyCodeCasing('объяви переменную юзер айди в camelCase'),
    'объяви userId'
  )
  // snake_case with explicit keyword
  assert.equal(
    applyCodeCasing('создай функцию get auth token в snake_case'),
    'создай get_auth_token'
  )
  // CONSTANT_CASE with explicit keyword
  assert.equal(
    applyCodeCasing('добавь константу max retry count в constantCase'),
    'добавь MAX_RETRY_COUNT'
  )
  // PascalCase with explicit keyword
  assert.equal(
    applyCodeCasing('создай класс user profile в pascalCase'),
    'создай UserProfile'
  )
  // kebab-case with explicit keyword
  assert.equal(
    applyCodeCasing('тип custom error handler в kebabCase'),
    'custom-error-handler'
  )
  // Direct suffix without keyword
  assert.equal(
    applyCodeCasing('auth service в camelCase'),
    'authService'
  )
})

test('Issue #321: cleanFillerWords removes verbal clutter and stuttering duplicates', () => {
  // Deduplicate adjacent stutters (Russian & English)
  assert.equal(cleanFillerWords('мы мы проверяем этот этот код'), 'мы проверяем этот код')
  assert.equal(cleanFillerWords('check check this build'), 'check this build')

  // Multi-word verbal fillers
  assert.equal(
    cleanFillerWords('ну типа как бы всё готово так сказать к релизу короче говоря'),
    'всё готово к релизу'
  )

  // Single verbal fillers (Russian & English)
  assert.equal(cleanFillerWords('ну короче типа запускаем'), 'запускаем')
  assert.equal(cleanFillerWords('uh basically this is um working'), 'this is working')
})

test('Issue #320, #321: normalizePhrase integrates filler cleaning and code casing', () => {
  const res = normalizePhrase('ну короче объяви переменную юзер нейм в camelCase пожалуйста', {
    allowPunctuation: true,
  })
  assert.ok(res.includes('userName'))
  assert.ok(!res.includes('ну короче'))
})

test('Issue #320: DEFAULT_BILINGUAL_PROMPT and buildTranscriptionPrompt contain modern dev terms', () => {
  assert.ok(DEFAULT_BILINGUAL_PROMPT.includes('k8s'))
  assert.ok(DEFAULT_BILINGUAL_PROMPT.includes('kubectl'))
  assert.ok(DEFAULT_BILINGUAL_PROMPT.includes('PostgreSQL'))
  assert.ok(DEFAULT_BILINGUAL_PROMPT.includes('Redis'))

  const promptObj = buildTranscriptionPrompt({ bilingualDeveloperPrompt: true, language: 'ru' })
  assert.ok(promptObj.keywords.includes('GraphQL'))
  assert.ok(promptObj.keywords.includes('Next.js'))
  assert.ok(promptObj.keywords.includes('FastAPI'))
  assert.ok(promptObj.keywords.includes('rebase'))
  assert.ok(promptObj.keywords.includes('cherry-pick'))
})

