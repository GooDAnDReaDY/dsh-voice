import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  VoiceError,
  ProviderAuthError,
  ProviderQuotaError,
  ProviderRateLimitError,
  ProviderServerError,
  DaemonUnavailableError,
  AudioFormatError,
  ChainExhaustedError,
  classifyHttpError,
  classifyProviderOutcome,
  shouldFallbackError,
} from '../lib/errors.js'
import { runChain } from '../lib/chain.js'

test('Issue #309: domain error hierarchy properties and serialization', () => {
  const authErr = new ProviderAuthError('Invalid API key', { provider: 'deepgram', status: 401 })
  assert.ok(authErr instanceof Error)
  assert.ok(authErr instanceof VoiceError)
  assert.equal(authErr.code, 'PROVIDER_AUTH_ERROR')
  assert.equal(authErr.provider, 'deepgram')
  assert.equal(authErr.status, 401)
  assert.equal(authErr.isRetryable, false)
  assert.equal(authErr.shouldFallback(), true)
  assert.deepEqual(authErr.toJSON(), {
    ok: false,
    code: 'PROVIDER_AUTH_ERROR',
    message: 'Invalid API key',
    provider: 'deepgram',
    status: 401,
    isRetryable: false,
    fallbackEligible: true,
  })

  const quotaErr = new ProviderQuotaError('Insufficient credit', { provider: 'openai', status: 402 })
  assert.equal(quotaErr.code, 'PROVIDER_QUOTA_ERROR')
  assert.equal(quotaErr.isRetryable, false)
  assert.equal(quotaErr.shouldFallback(), true)

  const rateErr = new ProviderRateLimitError('Too many requests', { provider: 'groq', status: 429, retryAfterMs: 2000 })
  assert.equal(rateErr.code, 'PROVIDER_RATE_LIMIT')
  assert.equal(rateErr.isRetryable, true)
  assert.equal(rateErr.retryAfterMs, 2000)
  assert.equal(rateErr.shouldFallback(), true)

  const srvErr = new ProviderServerError('Bad gateway', { provider: 'hf', status: 502 })
  assert.equal(srvErr.code, 'PROVIDER_SERVER_ERROR')
  assert.equal(srvErr.isRetryable, true)
  assert.equal(srvErr.shouldFallback(), true)

  const daemonErr = new DaemonUnavailableError('whisper-server offline', { provider: 'local-whisper' })
  assert.equal(daemonErr.code, 'DAEMON_UNAVAILABLE')
  assert.equal(daemonErr.isRetryable, false)
  assert.equal(daemonErr.shouldFallback(), true)

  const audioErr = new AudioFormatError('Corrupt audio payload')
  assert.equal(audioErr.code, 'AUDIO_FORMAT_ERROR')
  assert.equal(audioErr.isRetryable, false)
  assert.equal(audioErr.shouldFallback(), false)
  assert.equal(shouldFallbackError(audioErr), false)
})

test('Issue #309: classifyHttpError maps status codes and quota messages accurately', () => {
  const e401 = classifyHttpError('deepgram', 401, 'Deepgram invalid key')
  assert.ok(e401 instanceof ProviderAuthError)
  assert.equal(e401.code, 'PROVIDER_AUTH_ERROR')

  const e402 = classifyHttpError('openai', 402, 'Payment required')
  assert.ok(e402 instanceof ProviderQuotaError)

  const eQuota403 = classifyHttpError('groq', 403, 'Organization usage limit reached for this month')
  assert.ok(eQuota403 instanceof ProviderQuotaError)

  const headers = new Headers({ 'retry-after': '4' })
  const e429 = classifyHttpError('groq', 429, 'Rate limit', headers)
  assert.ok(e429 instanceof ProviderRateLimitError)
  assert.equal(e429.retryAfterMs, 4000)

  const e503 = classifyHttpError('hf', 503, 'Model loading')
  assert.ok(e503 instanceof ProviderServerError)
  assert.equal(e503.isRetryable, true)
})

test('Issue #309: runChain aborts immediately on non-fallback AudioFormatError and records typed attempts on ChainExhaustedError', async () => {
  let secondCalled = false
  await assert.rejects(
    () => runChain(['first', 'second'], {
      first: async () => { throw new AudioFormatError('corrupt header', { provider: 'first', fallbackEligible: false }) },
      second: async () => { secondCalled = true; return { ok: true, provider: 'second', text: 'ok' } },
    }),
    (err) => {
      assert.ok(err instanceof AudioFormatError)
      assert.equal(err.code, 'AUDIO_FORMAT_ERROR')
      return true
    }
  )
  assert.equal(secondCalled, false, 'second provider must not be called when shouldFallback() is false')

  await assert.rejects(
    () => runChain(['deepgram', 'groq', 'local-whisper'], {
      deepgram: async () => ({ ok: false, provider: 'deepgram', reason: 'no DEEPGRAM_API_KEY' }),
      groq: async () => { throw classifyHttpError('groq', 429, 'Groq HTTP 429 rate limit') },
      'local-whisper': async () => ({ ok: false, provider: 'local-whisper', reason: 'whisper server offline' }),
    }),
    (err) => {
      assert.ok(err instanceof ChainExhaustedError)
      assert.equal(err.code, 'CHAIN_EXHAUSTED')
      assert.equal(err.isRetryable, true)
      assert.equal(err.attempts.length, 3)
      assert.equal(err.attempts[0].code, 'PROVIDER_AUTH_ERROR')
      assert.equal(err.attempts[1].code, 'PROVIDER_RATE_LIMIT')
      assert.equal(err.attempts[2].code, 'DAEMON_UNAVAILABLE')
      return true
    }
  )
})
