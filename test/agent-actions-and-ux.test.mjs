import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractVoiceActions } from '../lib/normalize.js'
import { sessionCommand } from '../lib/transcribe-core.js'
import { BaseConfig } from '../lib/schema.js'
import { CLIENT_MODULE_MANIFEST } from '../scripts/build-client.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

test('Issue #322: extractVoiceActions detects agent control commands (standalone & trailing)', () => {
  // stop_generation
  assert.deepEqual(extractVoiceActions('останови генерацию'), { text: '', action: 'stop_generation' })
  assert.deepEqual(extractVoiceActions('останови агента'), { text: '', action: 'stop_generation' })
  assert.deepEqual(extractVoiceActions('стоп агент'), { text: '', action: 'stop_generation' })
  assert.deepEqual(extractVoiceActions('stop generation!'), { text: '', action: 'stop_generation' })
  assert.deepEqual(extractVoiceActions('stop agent'), { text: '', action: 'stop_generation' })
  assert.deepEqual(extractVoiceActions('停止生成'), { text: '', action: 'stop_generation' })
  assert.deepEqual(extractVoiceActions('погоди, останови агента'), { text: 'погоди', action: 'stop_generation' })

  // switch_dictation
  assert.deepEqual(extractVoiceActions('режим диктовки'), { text: '', action: 'switch_dictation' })
  assert.deepEqual(extractVoiceActions('dictation mode'), { text: '', action: 'switch_dictation' })
  assert.deepEqual(extractVoiceActions('switch to dictation'), { text: '', action: 'switch_dictation' })
  assert.deepEqual(extractVoiceActions('подожди, switch to dictation'), { text: 'подожди', action: 'switch_dictation' })

  // switch_voice_note
  assert.deepEqual(extractVoiceActions('режим голосового'), { text: '', action: 'switch_voice_note' })
  assert.deepEqual(extractVoiceActions('voice note mode'), { text: '', action: 'switch_voice_note' })
  assert.deepEqual(extractVoiceActions('switch to voice note'), { text: '', action: 'switch_voice_note' })
  assert.deepEqual(extractVoiceActions('слушай, switch to voice note'), { text: 'слушай', action: 'switch_voice_note' })

  // new_chat
  assert.deepEqual(extractVoiceActions('новый чат'), { text: '', action: 'new_chat' })
  assert.deepEqual(extractVoiceActions('new chat'), { text: '', action: 'new_chat' })
  assert.deepEqual(extractVoiceActions('新建对话'), { text: '', action: 'new_chat' })

  // clear
  assert.deepEqual(extractVoiceActions('очисти'), { text: '', action: 'clear' })
  assert.deepEqual(extractVoiceActions('clear'), { text: '', action: 'clear' })
  assert.deepEqual(extractVoiceActions('clear all'), { text: '', action: 'clear' })
  assert.deepEqual(extractVoiceActions('清空'), { text: '', action: 'clear' })
  assert.deepEqual(extractVoiceActions('ошибся текстом, очисти'), { text: 'ошибся текстом', action: 'clear' })
})

test('Issue #322: sessionCommand detects agent control and mode switching commands', () => {
  assert.equal(sessionCommand('стоп'), 'stop')
  assert.equal(sessionCommand('останови генерацию'), 'stop_generation')
  assert.equal(sessionCommand('стоп агент'), 'stop_generation')
  assert.equal(sessionCommand('stop generation'), 'stop_generation')
  assert.equal(sessionCommand('режим диктовки'), 'switch_dictation')
  assert.equal(sessionCommand('switch to dictation'), 'switch_dictation')
  assert.equal(sessionCommand('режим голосового'), 'switch_voice_note')
  assert.equal(sessionCommand('switch to voice note'), 'switch_voice_note')
})

test('Issue #323: BaseConfig validates audioFeedback toggle with default true', () => {
  const parsedDefault = BaseConfig({})
  assert.equal(parsedDefault.audioFeedback, true)

  const parsedFalse = BaseConfig({ audioFeedback: false })
  assert.equal(parsedFalse.audioFeedback, false)
})

test('Issue #322, #323: CLIENT_MODULE_MANIFEST registers modular audio-cues and voice-actions fragments', () => {
  const ids = CLIENT_MODULE_MANIFEST.map((m) => m.id)
  assert.ok(ids.includes('ui/audio-cues'))
  assert.ok(ids.includes('recording/actions'))

  const cuesPath = path.join(rootDir, 'lib', 'client-src', '23-audio-cues.js')
  const actionsPath = path.join(rootDir, 'lib', 'client-src', '44-voice-actions.js')
  assert.ok(fs.existsSync(cuesPath), '23-audio-cues.js must exist')
  assert.ok(fs.existsSync(actionsPath), '44-voice-actions.js must exist')

  const cuesSrc = fs.readFileSync(cuesPath, 'utf8')
  assert.ok(cuesSrc.includes('playAudioCue'))
  assert.ok(cuesSrc.includes('AudioContext'))

  const actionsSrc = fs.readFileSync(actionsPath, 'utf8')
  assert.ok(actionsSrc.includes('executeVoiceAction'))
  assert.ok(actionsSrc.includes('clearDraft'))
  assert.ok(actionsSrc.includes('stop_generation'))
  assert.ok(actionsSrc.includes('switch_dictation'))
  assert.ok(actionsSrc.includes('switch_voice_note'))
  assert.ok(actionsSrc.includes('new_chat'))
})

test('Issue #323: Client locale contains symmetric audioFeedback keys', () => {
  const locSrc = fs.readFileSync(path.join(rootDir, 'lib', 'client-src', '10-locale.js'), 'utf8')
  assert.ok(locSrc.includes("'audioFeedback':"), '10-locale.js must have audioFeedback key')
})

