import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runChain } from '../lib/chain.js'
import { createStatsTracker, mergeContextVocabulary } from '../lib/stats.js'

test('runChain вызывает onAttempt для успешного провайдера', async () => {
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

test('runChain вызывает onAttempt при отказе и исключении в цепочке', async () => {
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

test('createStatsTracker аккумулирует успехи, ошибки и среднюю задержку', () => {
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

test('mergeContextVocabulary объединяет базовый словарь с контекстными терминами', () => {
  const base = ['Cordis', 'DeepSeek']
  const context = ['Cordis', 'React', 'useState', 'a', '', 'PostgreSQL']
  const merged = mergeContextVocabulary(base, context, 10)
  assert.deepEqual(merged, ['Cordis', 'DeepSeek', 'React', 'useState', 'PostgreSQL'])
})

test('mergeContextVocabulary соблюдает лимит maxWords', () => {
  const base = ['w1', 'w2']
  const context = ['w3', 'w4', 'w5', 'w6']
  const merged = mergeContextVocabulary(base, context, 4)
  assert.equal(merged.length, 4)
  assert.deepEqual(merged, ['w1', 'w2', 'w3', 'w4'])
})

test('mergeContextVocabulary устойчива к null и undefined', () => {
  assert.deepEqual(mergeContextVocabulary(null, null), [])
  assert.deepEqual(mergeContextVocabulary(['test'], null), ['test'])
})
