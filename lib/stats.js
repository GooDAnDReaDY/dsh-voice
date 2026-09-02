// dsh-voice — чистые утилиты метрик провайдеров и объединения контекстного словаря.
// Без cordis и без сети — тестируются юнит-тестами.

export function createStatsTracker() {
  const stats = new Map()

  function record(key, res = {}) {
    if (!key) return
    const cur = stats.get(key) || {
      attempts: 0,
      successes: 0,
      failures: 0,
      totalTookMs: 0,
      avgTookMs: 0,
      lastTookMs: 0,
      lastError: '',
      lastSuccessAt: 0,
      lastErrorAt: 0,
    }
    cur.attempts += 1
    cur.lastTookMs = res.tookMs || 0
    if (res.ok) {
      cur.successes += 1
      cur.totalTookMs += res.tookMs || 0
      cur.avgTookMs = Math.round(cur.totalTookMs / cur.successes)
      cur.lastSuccessAt = Date.now()
    } else {
      cur.failures += 1
      cur.lastError = String(res.reason || 'unknown').slice(0, 150)
      cur.lastErrorAt = Date.now()
    }
    stats.set(key, cur)
  }

  function get() {
    const out = {}
    for (const [k, v] of stats.entries()) {
      out[k] = {
        attempts: v.attempts,
        successes: v.successes,
        failures: v.failures,
        avgTookMs: v.avgTookMs || v.lastTookMs || 0,
        lastTookMs: v.lastTookMs || 0,
        lastError: v.lastError,
        lastSuccessAt: v.lastSuccessAt,
        lastErrorAt: v.lastErrorAt,
      }
    }
    return out
  }

  function clear() {
    stats.clear()
  }

  return { record, get, clear }
}

export function mergeContextVocabulary(baseVocab = [], contextWords = [], maxWords = 50) {
  const vocab = Array.isArray(baseVocab) ? [...baseVocab] : []
  if (!Array.isArray(contextWords) || contextWords.length === 0) return vocab
  const seen = new Set(vocab.map((w) => String(w).toLowerCase()))
  for (const word of contextWords) {
    const clean = String(word || '').trim()
    if (clean && clean.length >= 2 && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase())
      vocab.push(clean)
      if (vocab.length >= maxWords) break
    }
  }
  return vocab
}
