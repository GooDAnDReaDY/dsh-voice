import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BaseConfig } from '../lib/schema.js'
import { loadClientPlugin } from './helpers/load-client.mjs'

const client = loadClientPlugin()
const { voice } = client._test
const { insertDraftText } = voice._core

test('lib/schema.js: BaseConfig defines lowVolumeThreshold with 0.08 default and 0..1 bounds (#14, #298)', () => {
  const cfgDefault = BaseConfig({})
  assert.equal(cfgDefault.lowVolumeThreshold, 0.08, 'default lowVolumeThreshold should be 0.08')

  const cfgCustom = BaseConfig({ lowVolumeThreshold: 0.03 })
  assert.equal(cfgCustom.lowVolumeThreshold, 0.03, 'custom lowVolumeThreshold should be accepted')

  const cfgZero = BaseConfig({ lowVolumeThreshold: 0 })
  assert.equal(cfgZero.lowVolumeThreshold, 0, 'zero should be accepted to allow disabling')

  const cfgMax = BaseConfig({ lowVolumeThreshold: 1 })
  assert.equal(cfgMax.lowVolumeThreshold, 1, 'max bound 1 should be accepted')

  assert.throws(() => {
    BaseConfig({ lowVolumeThreshold: -0.01 })
  }, 'negative threshold must be rejected')

  assert.throws(() => {
    BaseConfig({ lowVolumeThreshold: 1.01 })
  }, 'threshold > 1 must be rejected')

  assert.throws(() => {
    BaseConfig({ lowVolumeThreshold: 'invalid' })
  }, 'non-number threshold must be rejected')
})

test('insertDraftText: adds space between consecutive chunks when inserting via actions.insertText (#13, #297)', () => {
  let inserted = []
  let currentDraft = 'hello'

  const mockTarget = {
    input: {
      get draft() { return currentDraft }
    },
    actions: {
      insertText: (text) => {
        inserted.push(text)
        currentDraft += text
        return true
      }
    }
  }

  // 1. Text following non-whitespace word gets leading space
  inserted = []
  currentDraft = 'hello'
  insertDraftText('world', mockTarget)
  assert.equal(inserted[0], ' world', 'must prepend space after word')

  // 2. Text following trailing whitespace does NOT get another space
  inserted = []
  currentDraft = 'hello '
  insertDraftText('world', mockTarget)
  assert.equal(inserted[0], 'world', 'must not add double space')

  // 3. Text following newline does NOT get leading space
  inserted = []
  currentDraft = 'hello\n'
  insertDraftText('world', mockTarget)
  assert.equal(inserted[0], 'world', 'must not add space after newline')

  // 4. Text into empty draft does NOT get leading space
  inserted = []
  currentDraft = ''
  insertDraftText('world', mockTarget)
  assert.equal(inserted[0], 'world', 'must not add space to empty draft')

  // 5. Punctuation chunk does NOT get leading space
  for (const punct of ['.', ',', ';', ':', '!', '?', '…', '»', ')', ']', '}']) {
    inserted = []
    currentDraft = 'hello'
    insertDraftText(punct + ' test', mockTarget)
    assert.equal(inserted[0], punct + ' test', `must not prepend space before ${punct}`)
  }

  // 6. Draft ending with opening bracket/quote does NOT get leading space
  for (const openChar of ['(', '[', '"', "'", '«']) {
    inserted = []
    currentDraft = 'hello ' + openChar
    insertDraftText('world', mockTarget)
    assert.equal(inserted[0], 'world', `must not prepend space after open char ${openChar}`)
  }

  // 7. Text starting with leading space does NOT get double space
  inserted = []
  currentDraft = 'hello'
  insertDraftText(' world', mockTarget)
  assert.equal(inserted[0], ' world', 'must not add extra space if text already has leading space')
})

test('insertDraftText: adds space between consecutive chunks when inserting via span (#13, #297)', () => {
  let inserted = []
  const mockTarget = {
    input: { draft: 'prev' },
    span: {
      insertText: (text) => {
        inserted.push(text)
        return true
      }
    }
  }
  insertDraftText('next', mockTarget)
  assert.equal(inserted[0], ' next', 'must prepend space when calling span.insertText')
})
