// lib/errors.js — Typed domain error hierarchy and failure classification (#309)

export class VoiceError extends Error {
  /**
   * @param {string} message
   * @param {{
   *   code?: string,
   *   provider?: string,
   *   status?: number,
   *   isRetryable?: boolean,
   *   fallbackEligible?: boolean,
   *   retryAfterMs?: number,
   *   cause?: unknown
   * }} [options]
   */
  constructor(message, options = {}) {
    super(message)
    this.name = new.target.name
    this.code = options.code || 'VOICE_ERROR'
    this.provider = options.provider || ''
    if (typeof options.status === 'number') this.status = options.status
    this.isRetryable = Boolean(options.isRetryable)
    this.fallbackEligible = options.fallbackEligible !== false
    if (typeof options.retryAfterMs === 'number') this.retryAfterMs = options.retryAfterMs
    if (options.cause !== undefined) this.cause = options.cause
  }

  /**
   * Whether the STT fallback chain should advance to the next provider.
   * @returns {boolean}
   */
  shouldFallback() {
    return this.fallbackEligible
  }

  toJSON() {
    return {
      ok: false,
      code: this.code,
      message: this.message,
      ...(this.provider ? { provider: this.provider } : {}),
      ...(this.status !== undefined ? { status: this.status } : {}),
      isRetryable: this.isRetryable,
      fallbackEligible: this.fallbackEligible,
      ...(this.retryAfterMs !== undefined ? { retryAfterMs: this.retryAfterMs } : {}),
    }
  }
}

export class ProviderAuthError extends VoiceError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'PROVIDER_AUTH_ERROR',
      isRetryable: false,
      fallbackEligible: options.fallbackEligible !== false,
    })
  }
}

export class ProviderQuotaError extends VoiceError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'PROVIDER_QUOTA_ERROR',
      isRetryable: false,
      fallbackEligible: options.fallbackEligible !== false,
    })
  }
}

export class ProviderRateLimitError extends VoiceError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'PROVIDER_RATE_LIMIT',
      isRetryable: true,
      fallbackEligible: options.fallbackEligible !== false,
    })
  }
}

export class ProviderServerError extends VoiceError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'PROVIDER_SERVER_ERROR',
      isRetryable: options.isRetryable ?? true,
      fallbackEligible: options.fallbackEligible !== false,
    })
  }
}

export class DaemonUnavailableError extends VoiceError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'DAEMON_UNAVAILABLE',
      isRetryable: false,
      fallbackEligible: options.fallbackEligible !== false,
    })
  }
}

export class AudioFormatError extends VoiceError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'AUDIO_FORMAT_ERROR',
      isRetryable: false,
      fallbackEligible: Boolean(options.fallbackEligible),
    })
  }
}

export class ChainExhaustedError extends VoiceError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'CHAIN_EXHAUSTED',
      isRetryable: Boolean(options.isRetryable),
      fallbackEligible: false,
    })
    this.attempts = Array.isArray(options.attempts) ? options.attempts : []
  }

  toJSON() {
    return {
      ...super.toJSON(),
      attempts: this.attempts,
    }
  }
}

export function isQuotaText(detail = '') {
  const lower = String(detail).toLowerCase()
  return /\bquota\b/.test(lower)
    || lower.includes('usage limit')
    || lower.includes('usage_limit')
    || lower.includes('limit reached')
    || lower.includes('insufficient credit')
    || lower.includes('insufficient balance')
    || lower.includes('insufficient funds')
    || lower.includes('credit balance')
    || lower.includes('out of credit')
    || lower.includes('payment required')
    || lower.includes('billing')
}

export function parseRetryAfterMs(headers) {
  if (!headers || typeof headers.get !== 'function') return undefined
  const raw = headers.get('retry-after')
  if (raw === null || raw === undefined || String(raw).trim() === '') return undefined
  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.trunc(seconds * 1000)
  const at = Date.parse(raw)
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : undefined
}

/**
 * Classify an HTTP status and message into a typed VoiceError subclass.
 * @param {string} provider
 * @param {number} status
 * @param {string} message
 * @param {Headers} [headers]
 * @returns {VoiceError}
 */
export function classifyHttpError(provider, status, message, headers) {
  const msg = String(message || `HTTP ${status}`).trim()
  const retryAfterMs = parseRetryAfterMs(headers)
  const opts = { provider, status, ...(retryAfterMs !== undefined ? { retryAfterMs } : {}) }

  if (status === 402 || (isQuotaText(msg) && status !== 401)) {
    return new ProviderQuotaError(msg, opts)
  }
  if (status === 401 || status === 403) {
    return new ProviderAuthError(msg, opts)
  }
  if (status === 429) {
    return new ProviderRateLimitError(msg, opts)
  }
  if (status === 415 || status === 422) {
    return new AudioFormatError(msg, { ...opts, fallbackEligible: true })
  }
  if (status === 408 || status === 504 || status >= 500) {
    return new ProviderServerError(msg, opts)
  }
  return new VoiceError(msg, { ...opts, code: 'PROVIDER_HTTP_ERROR', isRetryable: false, fallbackEligible: true })
}

/**
 * Classify a provider refusal object or thrown Error into a VoiceError.
 * @param {string} provider
 * @param {unknown} outcomeOrErr
 * @returns {VoiceError}
 */
export function classifyProviderOutcome(provider, outcomeOrErr) {
  if (outcomeOrErr instanceof VoiceError) {
    if (!outcomeOrErr.provider && provider) outcomeOrErr.provider = provider
    return outcomeOrErr
  }
  if (outcomeOrErr instanceof Error) {
    const rawMsg = outcomeOrErr?.cause?.message || outcomeOrErr?.message || String(outcomeOrErr)
    const msg = rawMsg.slice(0, 200)
    const statusMatch = msg.match(/\bHTTP\s+(\d{3})\b/i)
    if (statusMatch) {
      return classifyHttpError(provider, Number(statusMatch[1]), msg)
    }
    if (isQuotaText(msg)) {
      return new ProviderQuotaError(msg, { provider, cause: outcomeOrErr })
    }
    if (/econnrefused|enotfound|fetch failed|daemon|not running|offline/i.test(msg)) {
      return new DaemonUnavailableError(msg, { provider, cause: outcomeOrErr })
    }
    return new VoiceError(msg, {
      provider,
      code: 'PROVIDER_RUNTIME_ERROR',
      isRetryable: /timeout|timed out|aborted|network/i.test(msg),
      fallbackEligible: true,
      cause: outcomeOrErr,
    })
  }
  if (outcomeOrErr && typeof outcomeOrErr === 'object') {
    const reason = String(outcomeOrErr.reason || outcomeOrErr.message || 'unknown').slice(0, 200)
    const p = String(outcomeOrErr.provider || provider || '')
    const fallbackEligible = outcomeOrErr.fallbackEligible !== false
    if (outcomeOrErr.code === 'AUDIO_FORMAT_ERROR') {
      return new AudioFormatError(reason, { provider: p, fallbackEligible })
    }
    if (/^no\s+[A-Z0-9_]+/i.test(reason) || /unauthorized|invalid.*key|forbidden/i.test(reason)) {
      return new ProviderAuthError(reason, { provider: p, fallbackEligible })
    }
    if (isQuotaText(reason)) {
      return new ProviderQuotaError(reason, { provider: p, fallbackEligible })
    }
    if (/offline|unreachable|not running|recognition runs in the page/i.test(reason)) {
      return new DaemonUnavailableError(reason, { provider: p, fallbackEligible })
    }
    return new VoiceError(reason, {
      provider: p,
      code: outcomeOrErr.code || 'PROVIDER_REFUSAL',
      isRetryable: false,
      fallbackEligible,
    })
  }
  return new VoiceError(String(outcomeOrErr || 'unknown').slice(0, 200), { provider })
}

export function shouldFallbackError(err) {
  if (err instanceof VoiceError) return err.shouldFallback()
  return true
}
