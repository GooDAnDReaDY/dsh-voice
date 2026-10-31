// Provider fallback chain. No network and no cordis — a pure function so
// failure behaviour is unit-testable.
import { classifyProviderOutcome, shouldFallbackError, ChainExhaustedError } from './errors.js'

/**
 * @param order {string[]} provider keys in attempt order
 * @param providers {Record<string, () => Promise<{ok, provider?, text?, reason?, code?, fallbackEligible?}>>}
 * @param onAttempt {(provider: string, res: {ok: boolean, tookMs: number, reason?: string, code?: string}) => void} optional stats callback
 * @returns {Promise<{provider: string, text: string, tookMs: number}>}
 */
export async function runChain(order, providers, onAttempt) {
  const t0 = Date.now()
  const keys = (Array.isArray(order) ? order : []).filter((k) => typeof providers[k] === 'function')
  const errors = []
  const attempts = []
  for (const key of keys) {
    const startT = Date.now()
    try {
      const out = await providers[key]()
      const tookMs = Date.now() - startT
      if (out && out.ok) {
        if (typeof onAttempt === 'function') {
          onAttempt(out.provider || key, { ok: true, tookMs })
        }
        return { provider: out.provider || key, text: out.text, tookMs: Date.now() - t0 }
      }
      const classified = classifyProviderOutcome((out && out.provider) || key, out || { reason: 'unknown' })
      const pName = classified.provider || key
      if (typeof onAttempt === 'function') {
        onAttempt(pName, { ok: false, tookMs, reason: classified.message, code: classified.code })
      }
      attempts.push({
        provider: pName,
        code: classified.code,
        reason: classified.message,
        tookMs,
        isRetryable: classified.isRetryable,
      })
      errors.push(`${pName}: ${classified.message}`)
      if (!shouldFallbackError(classified)) {
        throw classified
      }
    } catch (err) {
      const tookMs = Date.now() - startT
      const classified = classifyProviderOutcome(key, err)
      if (!shouldFallbackError(classified)) {
        const alreadyRecorded = attempts.some(
          (a) => a.provider === (classified.provider || key) && a.reason === classified.message
        )
        if (!alreadyRecorded && typeof onAttempt === 'function') {
          onAttempt(classified.provider || key, {
            ok: false,
            tookMs,
            reason: classified.message,
            code: classified.code,
          })
        }
        throw classified
      }
      if (typeof onAttempt === 'function') {
        onAttempt(key, { ok: false, tookMs, reason: classified.message, code: classified.code })
      }
      attempts.push({
        provider: key,
        code: classified.code,
        reason: classified.message,
        tookMs,
        isRetryable: classified.isRetryable,
      })
      errors.push(`${key}: ${classified.message}`)
    }
  }
  const anyRetryable = attempts.some((a) => a.isRetryable)
  throw new ChainExhaustedError(`all providers failed (${errors.join('; ')})`, {
    attempts,
    isRetryable: anyRetryable,
  })
}
