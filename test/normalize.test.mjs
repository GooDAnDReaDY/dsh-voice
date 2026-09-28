import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhrase, wordsToDigits, capitalizeSentences, fixCommaSpacing, ensureTrailingPeriod } from '../lib/normalize.js'

test('capitalizeSentences: sentence start and after . ! ?', () => {
  assert.equal(capitalizeSentences('привет мир'), 'Привет мир')
  assert.equal(capitalizeSentences('иди сюда. повернись'), 'Иди сюда. Повернись')
  assert.equal(capitalizeSentences('где ты? идём'), 'Где ты? Идём')
})

test('fixCommaSpacing: space after comma', () => {
  assert.equal(fixCommaSpacing('один,два , три'), 'один, два, три')
})

test('ensureTrailingPeriod: trailing period', () => {
  assert.equal(ensureTrailingPeriod('привет'), 'привет.')
  assert.equal(ensureTrailingPeriod('уже есть.'), 'уже есть.')
  assert.equal(ensureTrailingPeriod(''), '')
})

test('wordsToDigits: Russian number words', () => {
  assert.equal(wordsToDigits('сто двадцать пять рублей'), '125 рублей')
  assert.equal(wordsToDigits('двадцать один'), '21')
  assert.equal(wordsToDigits('одно сообщение'), '1 сообщение')
  assert.equal(wordsToDigits('тысяча двести'), '1200')
  assert.equal(wordsToDigits('один миллион'), '1000000')
})

test('wordsToDigits: keeps ordinary Russian words with numeral roots', () => {
  assert.equal(wordsToDigits('Это просто хорошая история'), 'Это просто хорошая история')
  assert.equal(wordsToDigits('деревянный стол на кухне'), 'деревянный стол на кухне')
  assert.equal(wordsToDigits('моя родина и одинокий остров'), 'моя родина и одинокий остров')
  assert.equal(wordsToDigits('красная смородина'), 'красная смородина')
  assert.equal(wordsToDigits('чистота и порядок'), 'чистота и порядок')
})

test('normalizePhrase: full pipeline', () => {
  assert.equal(normalizePhrase('привет мир, это тест', { capSentences: true, commaSpacing: true, trailingPeriod: true }),
    'Привет мир, это тест.')
  assert.equal(normalizePhrase('сто двадцать пять', { digits: true }), '125')
})

import { isRussianLang } from '../lib/normalize.js'

test('isRussianLang detects language and falls back to text content (#175)', () => {
  assert.equal(isRussianLang('ru'), true)
  assert.equal(isRussianLang('ru-RU'), true)
  assert.equal(isRussianLang('ru_RU'), true)
  assert.equal(isRussianLang('en'), false)
  assert.equal(isRussianLang('zh'), false)

  // auto / empty string checks text content
  assert.equal(isRussianLang('', 'Привет мир'), true)
  assert.equal(isRussianLang('auto', 'Привет мир'), true)
  assert.equal(isRussianLang('', 'Hello world'), false)
  assert.equal(isRussianLang('auto', 'Hello world'), false)
  assert.equal(isRussianLang('auto', ''), false)
})

test('normalizePhrase respects language setting for Russian normalization (#175)', () => {
  // English transcript should not be processed by Russian digits or jargon
  const enText = 'one hundred twenty five commits on github'
  assert.equal(
    normalizePhrase(enText, { digits: true, jargon: true, lang: 'en' }),
    'one hundred twenty five commits on github'
  )

  // Russian transcript with lang: 'ru' converts numbers and jargon
  const ruText = 'запушил коммит на гитхаб сто двадцать пять'
  assert.equal(
    normalizePhrase(ruText, { digits: true, jargon: true, lang: 'ru' }),
    'запушил commit на GitHub 125'
  )

  // Auto-detection: Cyrillic text converts numbers
  assert.equal(
    normalizePhrase('двадцать один вопрос', { digits: true, lang: 'auto' }),
    '21 вопрос'
  )
})