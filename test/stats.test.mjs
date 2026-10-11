import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runChain } from '../lib/chain.js'
import { createStatsTracker, mergeContextVocabulary } from '../lib/stats.js'

test('runChain calls onAttempt for a successful provider', async () => {
  const attempts = []
  const onAttempt = (provider, res) => attempts.push({ provider, ...res })
  const providers = {
    fast: async () => ({ ok: true, text: 'быстро' }),
  }
  const out = await runChain(['fast'], providers, onAttempt)
  assert.equal(out.text, 'быстро')
  assert.equal(attempts.length, 1)
  assert.equal(attempts[0].provider, 'fast')
  assert.equal(attempts[0].ok, true)
  assert.ok(typeof attempts[0].tookMs === 'number')
})

test('runChain calls onAttempt on chain refusal and exception', async () => {
  const attempts = []
  const onAttempt = (provider, res) => attempts.push({ provider, ...res })
  const providers = {
    failing: async () => ({ ok: false, reason: 'rate limit 429' }),
    throwing: async () => { throw new Error('network down') },
    fallback: async () => ({ ok: true, text: 'спасено' }),
  }
  const out = await runChain(['failing', 'throwing', 'fallback'], providers, onAttempt)
  assert.equal(out.text, 'спасено')
  assert.equal(attempts.length, 3)
  assert.equal(attempts[0].provider, 'failing')
  assert.equal(attempts[0].ok, false)
  assert.match(attempts[0].reason, /rate limit 429/)
  assert.equal(attempts[1].provider, 'throwing')
  assert.equal(attempts[1].ok, false)
  assert.match(attempts[1].reason, /network down/)
  assert.equal(attempts[2].provider, 'fallback')
  assert.equal(attempts[2].ok, true)
})

test('createStatsTracker accumulates successes, failures and average latency', () => {
  const tracker = createStatsTracker()
  tracker.record('groq', { ok: true, tookMs: 100 })
  tracker.record('groq', { ok: true, tookMs: 200 })
  tracker.record('groq', { ok: false, tookMs: 50, reason: 'HTTP 429' })

  const stats = tracker.get()
  assert.ok(stats.groq)
  assert.equal(stats.groq.attempts, 3)
  assert.equal(stats.groq.successes, 2)
  assert.equal(stats.groq.failures, 1)
  assert.equal(stats.groq.avgTookMs, 150) // (100 + 200) / 2
  assert.equal(stats.groq.lastTookMs, 50)
  assert.equal(stats.groq.lastError, 'HTTP 429')
  assert.ok(stats.groq.lastSuccessAt > 0)
  assert.ok(stats.groq.lastErrorAt > 0)
})

test('mergeContextVocabulary merges base vocabulary with context terms', () => {
  const base = ['Cordis', 'DeepSeek']
  const context = ['Cordis', 'React', 'useState', 'a', '', 'PostgreSQL']
  const merged = mergeContextVocabulary(base, context, 10)
  assert.deepEqual(merged, ['Cordis', 'DeepSeek', 'React', 'useState', 'PostgreSQL'])
})

test('mergeContextVocabulary respects maxWords', () => {
  const base = ['w1', 'w2']
  const context = ['w3', 'w4', 'w5', 'w6']
  const merged = mergeContextVocabulary(base, context, 4)
  assert.equal(merged.length, 4)
  assert.deepEqual(merged, ['w1', 'w2', 'w3', 'w4'])
})

test('mergeContextVocabulary tolerates null and undefined', () => {
  assert.deepEqual(mergeContextVocabulary(null, null), [])
  assert.deepEqual(mergeContextVocabulary(['test'], null), ['test'])
})

test('createStatsTracker.get() returns a serializable object', () => {
  const tracker = createStatsTracker()
  const data = tracker.get()
  assert.equal(typeof data, 'object')
  assert.deepEqual(data, {})
  assert.equal(JSON.stringify(data), '{}')
})


test('createStatsTracker records diagnostics and exports anonymized report (#266)', () => {
  const tracker = createStatsTracker()
  tracker.record('sensevoice', { ok: true, tookMs: 120 })
  tracker.recordDiagnostic({
    mode: 'dictation',
    subMode: 'clean',
    mimeType: 'audio/webm',
    audioBytes: 15420,
    provider: 'sensevoice',
    success: true,
    totalTookMs: 145,
    vadMs: 25,
    sttMs: 120,
    polishMs: 0,
    wordCount: 12,
  })

  tracker.recordDiagnostic({
    mode: 'message',
    subMode: 'task',
    mimeType: 'audio/webm',
    audioBytes: 32000,
    provider: 'groq',
    success: false,
    totalTookMs: 500,
    vadMs: 30,
    sttMs: 0,
    error: 'rate limit 429',
  })

  const diagnostics = tracker.getDiagnostics()
  assert.equal(diagnostics.length, 2)
  assert.equal(diagnostics[0].provider, 'sensevoice')
  assert.equal(diagnostics[0].success, true)
  assert.equal(diagnostics[0].breakdown.sttMs, 120)
  assert.equal(diagnostics[0].wordCount, 12)
  assert.equal(diagnostics[1].success, false)
  assert.equal(diagnostics[1].error, 'rate limit 429')

  const report = tracker.exportAnonymizedReport({ version: '0.9.34' })
  assert.equal(report.app.version, '0.9.34')
  assert.ok(report.exportedAt)
  assert.ok(report.summary.sensevoice)
  assert.equal(report.recentDiagnostics.length, 2)

  // Verify anonymization: no raw text or audio base64 in report
  const reportStr = JSON.stringify(report)
  assert.equal(reportStr.includes('audioBase64'), false)
  assert.equal(reportStr.includes('rawData'), false)
  assert.equal(reportStr.includes('rawText'), false)

  tracker.clear()
  assert.equal(tracker.getDiagnostics().length, 0)
  assert.deepEqual(tracker.get(), {})
})
