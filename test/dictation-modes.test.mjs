import test from 'node:test'
import assert from 'node:assert/strict'
import { DICTATION_MODES, DEFAULT_DICTATION_PROMPTS, resolveDictationPrompt } from '../lib/dictation-modes.js'

test('DICTATION_MODES exports 4 canonical modes (#264)', () => {
  assert.deepEqual(DICTATION_MODES, ['verbatim', 'clean', 'task', 'note'])
})

test('resolveDictationPrompt: verbatim mode returns null to guarantee 0 LLM calls (#264)', () => {
  const prompt = resolveDictationPrompt('verbatim', {}, 'Привет мир')
  assert.equal(prompt, null, 'verbatim mode must return null (zero LLM calls)')
})

test('resolveDictationPrompt: clean mode formats text without fact alteration (#264)', () => {
  const prompt = resolveDictationPrompt('clean', {}, 'ээ ну типа привет')
  assert.ok(prompt.includes('Fix the punctuation and spelling'))
  assert.ok(prompt.includes('ээ ну типа привет'))
})

test('resolveDictationPrompt: task mode formats structured problem/outcome/constraints (#264)', () => {
  const prompt = resolveDictationPrompt('task', {}, 'нужно добавить кнопку отмены')
  assert.ok(prompt.includes('Problem/Goal'))
  assert.ok(prompt.includes('Expected Outcome'))
  assert.ok(prompt.includes('Constraints'))
  assert.ok(prompt.includes('Acceptance Criteria'))
  assert.ok(prompt.includes('нужно добавить кнопку отмены'))
})

test('resolveDictationPrompt: note mode extracts key points and action items (#264)', () => {
  const prompt = resolveDictationPrompt('note', {}, 'обсудили релиз в среду и тесты')
  assert.ok(prompt.includes('key points'))
  assert.ok(prompt.includes('action items'))
  assert.ok(prompt.includes('обсудили релиз в среду и тесты'))
})

test('resolveDictationPrompt: respects custom prompts and restores default when empty (#264)', () => {
  const custom = {
    clean: 'Custom clean: {text}',
    task: 'Custom task: {text}',
  }
  assert.equal(resolveDictationPrompt('clean', custom, 'текст'), 'Custom clean: текст')
  assert.equal(resolveDictationPrompt('task', custom, 'задача'), 'Custom task: задача')

  // Empty custom prompt restores default
  assert.ok(resolveDictationPrompt('note', custom, 'заметка').includes('key points'))
})


import { createPolishText } from '../lib/polish.js'

test('createPolishText: verbatim subMode skips LLM completely with 0 calls (#264)', async () => {
  let calls = 0
  const polish = createPolishText({
    resolveKey: async () => 'key',
    fetchImpl: async () => { calls++; return { ok: true, json: async () => ({}) } },
    getConfig: () => ({ polishBaseUrl: 'http://127.0.0.1:11434/v1' }),
    llm: null,
  })

  const res = await polish('конфигурация сервера nginx', { polish: true, subMode: 'verbatim' })
  assert.equal(res, 'конфигурация сервера nginx')
  assert.equal(calls, 0, 'verbatim mode must not invoke fetchImpl (zero LLM calls)')
})

test('createPolishText: localOnly prevents cloud polish when polishBaseUrl is absent (#264)', async () => {
  let streamCalls = 0
  const polish = createPolishText({
    resolveKey: async () => 'key',
    fetchImpl: async () => ({ ok: true }),
    getConfig: () => ({ localOnly: true, polishBaseUrl: '' }),
    llm: {
      async *stream() {
        streamCalls++
        yield { type: 'text-delta', text: 'cloud result' }
      },
    },
    getAgentDefaultModel: () => ({ provider: 'openai', model: 'gpt-4o' }),
  })

  const res = await polish('запрос к облаку', { polish: true, subMode: 'clean' })
  assert.equal(res, 'запрос к облаку', 'must preserve verbatim text without calling cloud')
  assert.equal(streamCalls, 0, 'must not invoke cloud LLM stream under localOnly')
})

test('createPolishText: task subMode sends structured agent prompt (#264)', async () => {
  let sentPrompt = ''
  const polish = createPolishText({
    resolveKey: async () => 'key',
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      sentPrompt = body.messages[0].content
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Structured Task Result' } }] }),
      }
    },
    getConfig: () => ({ polishBaseUrl: 'http://127.0.0.1:11434/v1' }),
    llm: null,
  })

  const res = await polish('нужно исправить баг в аутентификации', { polish: true, subMode: 'task' })
  assert.equal(res, 'Structured Task Result')
  assert.ok(sentPrompt.includes('Problem/Goal'), 'prompt must contain Problem/Goal')
  assert.ok(sentPrompt.includes('Expected Outcome'), 'prompt must contain Expected Outcome')
  assert.ok(sentPrompt.includes('Constraints'), 'prompt must contain Constraints')
  assert.ok(sentPrompt.includes('Acceptance Criteria'), 'prompt must contain Acceptance Criteria')
})
