import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractVoiceActions } from '../lib/normalize.js'

test('extractVoiceActions detects standalone commands', () => {
  assert.deepEqual(extractVoiceActions('отправь'), { text: '', action: 'send' })
  assert.deepEqual(extractVoiceActions('отправить.'), { text: '', action: 'send' })
  assert.deepEqual(extractVoiceActions('send!'), { text: '', action: 'send' })
  assert.deepEqual(extractVoiceActions('отмена'), { text: '', action: 'cancel' })
  assert.deepEqual(extractVoiceActions('cancel'), { text: '', action: 'cancel' })
  assert.deepEqual(extractVoiceActions('очисти'), { text: '', action: 'clear' })
  assert.deepEqual(extractVoiceActions('новая строка'), { text: '', action: 'newline' })
})

test('extractVoiceActions detects trailing commands and strips them', () => {
  assert.deepEqual(extractVoiceActions('Привет, как дела, отправь'), { text: 'Привет, как дела', action: 'send' })
  assert.deepEqual(extractVoiceActions('Пожалуйста, сделай ревью send.'), { text: 'Пожалуйста, сделай ревью', action: 'send' })
  assert.deepEqual(extractVoiceActions('Ошибся фразой отмена'), { text: 'Ошибся фразой', action: 'cancel' })
  assert.deepEqual(extractVoiceActions('Первая строка новая строка'), { text: 'Первая строка\n', action: 'newline' })
})

test('extractVoiceActions returns action: null for ordinary speech', () => {
  assert.deepEqual(extractVoiceActions('Просто обычный текст без команд'), { text: 'Просто обычный текст без команд', action: null })
  assert.deepEqual(extractVoiceActions(''), { text: '', action: null })
})

test('extractVoiceActions detects Chinese commands (standalone and trailing)', () => {
  assert.deepEqual(extractVoiceActions('发送'), { text: '', action: 'send' })
  assert.deepEqual(extractVoiceActions('取消'), { text: '', action: 'cancel' })
  assert.deepEqual(extractVoiceActions('清空'), { text: '', action: 'clear' })
  assert.deepEqual(extractVoiceActions('换行'), { text: '', action: 'newline' })
  assert.deepEqual(extractVoiceActions('这是测试内容 发送'), { text: '这是测试内容', action: 'send' })
  assert.deepEqual(extractVoiceActions('第一段内容 换行'), { text: '第一段内容\n', action: 'newline' })
})
