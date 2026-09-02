// Перебор цепочки провайдеров с фоллбеком. Без сети и без cordis — чистая
// функция, чтобы поведение при отказах можно было проверить юнит-тестом.

function normalizeError(err) {
  const cause = err?.cause?.message || err?.message || String(err)
  return cause.slice(0, 200)
}

/**
 * @param order {string[]} порядок ключей провайдеров
 * @param providers {Record<string, () => Promise<{ok, provider?, text?, reason?}>>}
 * @param onAttempt {(provider: string, res: {ok: boolean, tookMs: number, reason?: string}) => void} опциональный колбэк статистики
 * @returns {Promise<{provider: string, text: string, tookMs: number}>}
 */
export async function runChain(order, providers, onAttempt) {
  const t0 = Date.now()
  const keys = (Array.isArray(order) ? order : []).filter((k) => typeof providers[k] === 'function')
  const errors = []
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
      const reason = (out && out.reason) || 'unknown'
      if (typeof onAttempt === 'function') {
        onAttempt((out && out.provider) || key, { ok: false, tookMs, reason })
      }
      errors.push(`${(out && out.provider) || key}: ${reason}`)
    } catch (err) {
      const tookMs = Date.now() - startT
      const normErr = normalizeError(err)
      if (typeof onAttempt === 'function') {
        onAttempt(key, { ok: false, tookMs, reason: normErr })
      }
      errors.push(`${key}: ${normErr}`)
    }
  }
  throw new Error(`all providers failed (${errors.join('; ')})`)
}
