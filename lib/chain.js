// Перебор цепочки провайдеров с фоллбеком. Без сети и без cordis — чистая
// функция, чтобы поведение при отказах можно было проверить юнит-тестом.

function normalizeError(err) {
  const cause = err?.cause?.message || err?.message || String(err)
  return cause.slice(0, 200)
}

/**
 * @param order {string[]} порядок ключей провайдеров
 * @param providers {Record<string, () => Promise<{ok, provider?, text?, reason?}>>}
 * @returns {Promise<{provider: string, text: string, tookMs: number}>}
 */
export async function runChain(order, providers) {
  const t0 = Date.now()
  const keys = (Array.isArray(order) ? order : []).filter((k) => typeof providers[k] === 'function')
  const errors = []
  for (const key of keys) {
    try {
      const out = await providers[key]()
      if (out && out.ok) {
        return { provider: out.provider || key, text: out.text, tookMs: Date.now() - t0 }
      }
      errors.push(`${(out && out.provider) || key}: ${(out && out.reason) || 'unknown'}`)
    } catch (err) {
      errors.push(`${key}: ${normalizeError(err)}`)
    }
  }
  throw new Error(`all providers failed (${errors.join('; ')})`)
}
