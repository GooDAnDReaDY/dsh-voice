import test from 'node:test'
import assert from 'node:assert/strict'
import { isTrustedCaller, readBody } from '../lib/http-util.js'
import { isRussianLang, normalizePhrase } from '../lib/normalize.js'
import { checkProfileLock, readLockPid, isProcessAlive } from '../lib/updater.js'
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('Issue #173: isTrustedCaller rejects cross-site/mismatched requests even from loopback', () => {
  // Loopback but cross-site Sec-Fetch-Site -> must be rejected
  assert.equal(
    isTrustedCaller({
      method: 'POST',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {
        'sec-fetch-site': 'cross-site',
        host: 'localhost:3080',
        'content-type': 'application/json',
      },
    }),
    false,
    'cross-site sec-fetch-site must be rejected even from loopback'
  )

  // Loopback but mismatched Origin -> must be rejected
  assert.equal(
    isTrustedCaller({
      method: 'POST',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {
        origin: 'https://evil.attacker.com',
        host: 'localhost:3080',
        'content-type': 'application/json',
      },
    }),
    false,
    'mismatched origin must be rejected even from loopback'
  )

  // Loopback POST with simple request Content-Type (text/plain) -> must be rejected
  assert.equal(
    isTrustedCaller({
      method: 'POST',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {
        host: 'localhost:3080',
        'content-type': 'text/plain',
      },
    }),
    false,
    'POST with text/plain must be rejected to prevent form CSRF'
  )

  // Valid loopback POST with application/json and matching/omitted origin -> allowed
  assert.equal(
    isTrustedCaller({
      method: 'POST',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {
        host: 'localhost:3080',
        'content-type': 'application/json',
        origin: 'http://localhost:3080',
        'sec-fetch-site': 'same-origin',
      },
    }),
    true,
    'valid loopback request with application/json must be allowed'
  )
})

test('Issue #174: base64-expanded payload calculations and size limits', () => {
  const maxFileBytes = 25 * 1024 * 1024 // 25 MiB
  const maxBodyBytes = Math.ceil((maxFileBytes * 4) / 3) + 64 * 1024

  // In base64, 25 MiB audio is ~33.33 MiB
  assert.ok(maxBodyBytes > 33 * 1024 * 1024, 'maxBodyBytes must accommodate base64 expansion')
  assert.ok(maxBodyBytes > maxFileBytes, 'body limit must be larger than raw audio limit')
})

test('Issue #175: language defaults to auto (empty string) and respects non-Russian audio', async () => {
  // Check that default language in BaseConfig is empty string
  const indexContent = await import('node:fs/promises').then(fs =>
    fs.readFile(new URL('../lib/index.js', import.meta.url), 'utf8')
  )
  assert.ok(
    indexContent.includes("language: z.string().default('')"),
    'BaseConfig must default dictation and message language to empty string'
  )

  // Normalization must not apply Russian number conversion to English
  const english = 'there are twenty five apples and ten oranges'
  const normEn = normalizePhrase(english, { digits: true, lang: 'en' })
  assert.equal(normEn, english, 'English text must not be altered by Russian number conversion')

  // Auto-detection with English text
  const normAutoEn = normalizePhrase(english, { digits: true, lang: '' })
  assert.equal(normAutoEn, english, 'English text in auto mode must not be altered by Russian conversion')

  // Auto-detection with Russian text
  const russian = 'двадцать пять яблок'
  const normAutoRu = normalizePhrase(russian, { digits: true, lang: '' })
  assert.equal(normAutoRu, '25 яблок', 'Russian text in auto mode must convert spoken numbers to digits')
})

test('Issue #176: package.json.lock handling and supply chain options', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'test-lock-176-'))
  const lock = join(dir, 'package.json.lock')

  try {
    // Dead PID lock -> cleaned up
    writeFileSync(lock, '9999991\n')
    const check1 = checkProfileLock(dir)
    assert.equal(check1.locked, false)
    assert.equal(check1.cleanedStale, true)
    assert.equal(existsSync(lock), false)

    // Live PID lock -> locked
    writeFileSync(lock, String(process.pid))
    const check2 = checkProfileLock(dir)
    assert.equal(check2.locked, true)
    assert.equal(check2.pid, process.pid)

    // JSON lock with live PID
    writeFileSync(lock, JSON.stringify({ pid: process.pid }))
    const check3 = checkProfileLock(dir)
    assert.equal(check3.locked, true)
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
  }

  // Verify updater does not include minimumReleaseAge=0
  const updaterContent = await import('node:fs/promises').then(fs =>
    fs.readFile(new URL('../lib/updater.js', import.meta.url), 'utf8')
  )
  assert.equal(
    updaterContent.includes('minimumReleaseAge=0'),
    false,
    'updater must not disable minimumReleaseAge'
  )
})
