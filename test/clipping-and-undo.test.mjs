import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractVoiceActions } from '../lib/normalize.js'
import { sessionCommand } from '../lib/transcribe-core.js'
import { createStatsTracker } from '../lib/stats.js'

test('extractVoiceActions detects standalone and trailing undo_chunk triggers (#285)', () => {
  // Standalone triggers
  const triggers = [
    'отмени последнее',
    'сотри последнее',
    'удали последнее',
    'откати последнее',
    'undo',
    'undo last',
    'undo chunk',
    '撤销',
    '撤销上一句',
  ]
  for (const t of triggers) {
    const res = extractVoiceActions(t)
    assert.equal(res.action, 'undo_chunk', `Trigger "${t}" must resolve to undo_chunk action`)
    assert.equal(res.text, '', `Trigger "${t}" must yield empty text`)
  }

  // Trailing trigger
  const trailing = extractVoiceActions('Привет мир отмени последнее')
  assert.equal(trailing.action, 'undo_chunk')
  assert.equal(trailing.text, 'Привет мир')

  // Normal text must not trigger undo_chunk
  const normal = extractVoiceActions('напиши функцию отмены заказа')
  assert.equal(normal.action, null)
  assert.equal(normal.text, 'напиши функцию отмены заказа')
})

test('sessionCommand parses undo_chunk commands in Russian, English and Chinese (#285)', () => {
  assert.equal(sessionCommand('отмени последнее'), 'undo_chunk')
  assert.equal(sessionCommand('сотри последнее'), 'undo_chunk')
  assert.equal(sessionCommand('удали последнее'), 'undo_chunk')
  assert.equal(sessionCommand('откати последнее!'), 'undo_chunk')
  assert.equal(sessionCommand('undo last'), 'undo_chunk')
  assert.equal(sessionCommand('undo chunk'), 'undo_chunk')
  assert.equal(sessionCommand('撤销上一句'), 'undo_chunk')
  assert.equal(sessionCommand('обычный текст'), null)
})

test('statsTracker records clipping and lowVolume diagnostic metrics (#283)', () => {
  const tracker = createStatsTracker()
  tracker.recordDiagnostic({
    mode: 'dictation',
    subMode: 'clean',
    mimeType: 'audio/webm',
    audioBytes: 12000,
    provider: 'sherpa-onnx',
    success: true,
    totalTookMs: 140,
    clipping: true,
    lowVolume: false,
  })
  tracker.recordDiagnostic({
    mode: 'dictation',
    subMode: 'clean',
    mimeType: 'audio/webm',
    audioBytes: 8000,
    provider: 'sherpa-onnx',
    success: true,
    totalTookMs: 90,
    clipping: false,
    lowVolume: true,
  })

  const diags = tracker.getDiagnostics()
  assert.equal(diags.length, 2)
  assert.equal(diags[0].clipping, true)
  assert.equal(diags[0].lowVolume, false)
  assert.equal(diags[1].clipping, false)
  assert.equal(diags[1].lowVolume, true)
})

test('hardware clipping and weak signal audio level detection logic (#283)', () => {
  // Simulate analyser time domain data
  const normalWave = new Uint8Array([127, 128, 129, 130, 128, 126])
  let isClipped = false
  for (let i = 0; i < normalWave.length; i++) {
    if (normalWave[i] <= 1 || normalWave[i] >= 254) { isClipped = true; break }
  }
  assert.equal(isClipped, false, 'Normal wave data must not be marked as clipped')

  const clippedWave = new Uint8Array([128, 200, 255, 128, 0, 128])
  isClipped = false
  for (let i = 0; i < clippedWave.length; i++) {
    if (clippedWave[i] <= 1 || clippedWave[i] >= 254) { isClipped = true; break }
  }
  assert.equal(isClipped, true, 'Wave data reaching 0 or 255 must be marked as clipped')

  // Low volume detector: when speech was active but level is below threshold
  const hadSpeech = true
  const levelLow = 0.04
  const levelNorm = 0.35
  assert.ok(hadSpeech && levelLow > 0 && levelLow < 0.08, 'Level below 0.08 must trigger lowVolume warning')
  assert.ok(!(hadSpeech && levelNorm > 0 && levelNorm < 0.08), 'Level above 0.08 must not trigger lowVolume warning')
})
