import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhrase, wordsToDigits, capitalizeSentences, fixCommaSpacing, ensureTrailingPeriod } from '../lib/normalize.js'

test('capitalizeSentences: первая буква фразы и после . ! ?', () => {
  assert.equal(capitalizeSentences('привет мир'), 'Привет мир')
  assert.equal(capitalizeSentences('иди сюда. повернись'), 'Иди сюда. Повернись')
  assert.equal(capitalizeSentences('где ты? идём'), 'Где ты? Идём')
})

test('fixCommaSpacing: пробел после запятой', () => {
  assert.equal(fixCommaSpacing('один,два , три'), 'один, два, три')
})

test('ensureTrailingPeriod: точка в конце', () => {
  assert.equal(ensureTrailingPeriod('привет'), 'привет.')
  assert.equal(ensureTrailingPeriod('уже есть.'), 'уже есть.')
  assert.equal(ensureTrailingPeriod(''), '')
})

test('wordsToDigits: русские числа словами', () => {
  assert.equal(wordsToDigits('сто двадцать пять рублей'), '125 рублей')
  assert.equal(wordsToDigits('двадцать один'), '21')
  assert.equal(wordsToDigits('тысяча двести'), '1200')
  assert.equal(wordsToDigits('один миллион'), '1000000')
})

test('normalizePhrase: полный цикл', () => {
  assert.equal(normalizePhrase('привет мир, это тест', { capSentences: true, commaSpacing: true, trailingPeriod: true }),
    'Привет мир, это тест.')
  assert.equal(normalizePhrase('сто двадцать пять', { digits: true }), '125')
})