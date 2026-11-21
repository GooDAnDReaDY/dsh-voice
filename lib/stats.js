// dsh-voice — pure helpers for provider metrics and context vocabulary.
// No cordis and no network — unit-tested.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

let cachedVersion = null
function readPackageVersion() {
  if (cachedVersion) return cachedVersion
  try {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    cachedVersion = String(pkg.version || '0.9.59')
  } catch {
    cachedVersion = '0.9.59'
  }
  return cachedVersion
}

export function createStatsTracker(options = {}) {
  const stats = new Map()
  const diagnostics = []
  const MAX_DIAGNOSTICS = options.maxDiagnostics || 50
  const defaultVersion = options.version || readPackageVersion()
  const defaultPersistenceFile = path.join(os.homedir(), '.dsh', 'state', 'dsh-voice', 'diagnostics.jsonl')
  const persistenceFile = options.persistenceFile !== undefined
    ? options.persistenceFile
    : (options.persist === true ? defaultPersistenceFile : null)

  if (persistenceFile) {
    try {
      if (fs.existsSync(persistenceFile)) {
        const raw = fs.readFileSync(persistenceFile, 'utf8')
        const lines = raw.split('\n').filter(Boolean)
        for (const line of lines.slice(-MAX_DIAGNOSTICS)) {
          try {
            const entry = JSON.parse(line)
            if (entry && entry.id) {
              diagnostics.push(entry)
            }
          } catch { /* ignore malformed lines */ }
        }
      }
    } catch { /* ignore filesystem read error */ }
  }

  function recordDiagnostic(entry = {}) {
    const item = {
      id: Math.random().toString(36).slice(2, 10),
      timestamp: Date.now(),
      mode: entry.mode || 'dictation',
      subMode: entry.subMode || 'clean',
      mimeType: entry.mimeType || 'audio/webm',
      audioBytes: Number(entry.audioBytes) || 0,
      provider: entry.provider || 'unknown',
      success: !!entry.success,
      totalTookMs: Number(entry.totalTookMs) || 0,
      breakdown: {
        vadMs: Number(entry.vadMs) || 0,
        sttMs: Number(entry.sttMs) || 0,
        polishMs: Number(entry.polishMs) || 0,
      },
      chainAttempts: Array.isArray(entry.chainAttempts) ? entry.chainAttempts.map((a) => ({
        provider: a.provider || 'unknown',
        ok: !!a.ok,
        tookMs: Number(a.tookMs) || 0,
        reason: a.reason ? String(a.reason).slice(0, 150) : undefined,
      })) : [],
      error: entry.error ? String(entry.error).slice(0, 200) : undefined,
      wordCount: typeof entry.wordCount === 'number' ? entry.wordCount : undefined,
      clipping: entry.clipping !== undefined ? !!entry.clipping : undefined,
      lowVolume: entry.lowVolume !== undefined ? !!entry.lowVolume : undefined,
    }
    diagnostics.push(item)
    if (diagnostics.length > MAX_DIAGNOSTICS) {
      diagnostics.shift()
    }

    if (persistenceFile) {
      try {
        const dir = path.dirname(persistenceFile)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        try {
          const stat = fs.statSync(persistenceFile)
          if (stat.size > 1024 * 1024) {
            const dump = diagnostics.map((d) => JSON.stringify(d)).join('\n') + '\n'
            fs.writeFileSync(persistenceFile, dump, 'utf8')
            return item
          }
        } catch { /* file may not exist yet */ }
        fs.appendFileSync(persistenceFile, JSON.stringify(item) + '\n', 'utf8')
      } catch { /* ignore filesystem write error */ }
    }

    return item
  }

  function getDiagnostics() {
    return diagnostics.slice()
  }

  function exportAnonymizedReport(appInfo = {}) {
    return {
      exportedAt: new Date().toISOString(),
      app: {
        name: '@goodandready/dsh-voice',
        version: appInfo.version || defaultVersion,
        environment: appInfo.environment || 'production',
      },
      summary: get(),
      recentDiagnostics: getDiagnostics(),
    }
  }

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
    diagnostics.length = 0
    if (persistenceFile) {
      try {
        if (fs.existsSync(persistenceFile)) {
          fs.unlinkSync(persistenceFile)
        }
      } catch { /* ignore */ }
    }
  }

  return { record, get, clear, recordDiagnostic, getDiagnostics, exportAnonymizedReport }
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
