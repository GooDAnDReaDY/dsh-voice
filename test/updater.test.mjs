import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTrustedUpdateRequest, registerPluginUpdater } from '../lib/updater.js'

test('isTrustedUpdateRequest rejects remote, cross-site, or untrusted requests', () => {
  // Missing update header
  assert.equal(
    isTrustedUpdateRequest({
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    }),
    false,
    'request without x-dsh-plugin-update: 1 must be rejected'
  )

  // Remote address
  assert.equal(
    isTrustedUpdateRequest({
      headers: { 'x-dsh-plugin-update': '1', origin: 'http://192.168.1.50:3000', host: '192.168.1.50:3000' },
      socket: { remoteAddress: '192.168.1.50' },
    }),
    false,
    'remote IP must be rejected'
  )

  // Cross-site
  assert.equal(
    isTrustedUpdateRequest({
      headers: {
        'x-dsh-plugin-update': '1',
        'sec-fetch-site': 'cross-site',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      socket: { remoteAddress: '127.0.0.1' },
    }),
    false,
    'cross-site request must be rejected'
  )

  // Mismatched origin and host
  assert.equal(
    isTrustedUpdateRequest({
      headers: {
        'x-dsh-plugin-update': '1',
        origin: 'http://localhost:4000',
        host: 'localhost:3000',
      },
      socket: { remoteAddress: '127.0.0.1' },
    }),
    false,
    'mismatched origin and host must be rejected'
  )

  // Valid local same-origin request
  assert.equal(
    isTrustedUpdateRequest({
      headers: {
        'x-dsh-plugin-update': '1',
        'sec-fetch-site': 'same-origin',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      socket: { remoteAddress: '127.0.0.1' },
    }),
    true,
    'trusted same-origin loopback request must be accepted'
  )
})

test('registerPluginUpdater mounts update route with method checking', async () => {
  let registered = null
  const fakeCtx = {
    webServer: {
      register: (route) => {
        registered = route
        return () => {}
      },
    },
  }

  registerPluginUpdater(fakeCtx, {
    endpoint: '/api/dsh-voice/update',
    packageName: '@goodandready/dsh-voice',
  })

  assert.ok(registered)
  assert.equal(registered.path, '/api/dsh-voice/update')
  assert.equal(registered.kind, 'exact')

  // DELETE request returns 405 Method Not Allowed
  let status = 0
  await registered.handler({ method: 'DELETE' }, {
    writeHead: (s) => { status = s },
    end: () => {},
  })
  assert.equal(status, 405)

  // Untrusted POST returns 403 Forbidden
  let postStatus = 0
  await registered.handler({
    method: 'POST',
    headers: {},
    socket: { remoteAddress: '192.168.1.99' },
  }, {
    writeHead: (s) => { postStatus = s },
    end: () => {},
  })
  assert.equal(postStatus, 403)
})

import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readLockPid, isProcessAlive, checkProfileLock } from '../lib/updater.js'

test('package.json.lock lifecycle and process alive detection (#176)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-voice-lock-'))
  const lockFile = join(dir, 'package.json.lock')

  try {
    // 1. No lock file
    assert.deepEqual(checkProfileLock(dir), { locked: false })

    // 2. Lock file with dead PID (e.g. 9999999) -> cleaned up automatically
    writeFileSync(lockFile, '9999999', 'utf8')
    const deadCheck = checkProfileLock(dir)
    assert.equal(deadCheck.locked, false)
    assert.equal(deadCheck.cleanedStale, true)
    assert.equal(existsSync(lockFile), false, 'stale lock must be removed')

    // 3. Lock file with current live PID -> reports locked
    writeFileSync(lockFile, String(process.pid), 'utf8')
    const liveCheck = checkProfileLock(dir)
    assert.equal(liveCheck.locked, true)
    assert.equal(liveCheck.pid, process.pid)

    // 4. JSON lock format {"pid": ...}
    writeFileSync(lockFile, JSON.stringify({ pid: process.pid }), 'utf8')
    assert.equal(readLockPid(lockFile), process.pid)

    // 5. isProcessAlive helper
    assert.equal(isProcessAlive(process.pid), true)
    assert.equal(isProcessAlive(9999999), false)
    assert.equal(isProcessAlive(null), false)
    assert.equal(isProcessAlive(-1), false)

    // 6. Unparsed or empty lock file is preserved and reports locked (#205)
    writeFileSync(lockFile, '', 'utf8')
    const emptyCheck = checkProfileLock(dir)
    assert.equal(emptyCheck.locked, true)
    assert.equal(emptyCheck.pid, null)
    assert.equal(existsSync(lockFile), true, 'empty lockfile must be preserved')

    writeFileSync(lockFile, 'invalid-json-content', 'utf8')
    const unparsedCheck = checkProfileLock(dir)
    assert.equal(unparsedCheck.locked, true)
    assert.equal(unparsedCheck.pid, null)
    assert.equal(existsSync(lockFile), true, 'unparsed lockfile must be preserved')
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
})

test('updater source code does not disable supply-chain protection (#176)', async () => {
  const { readFile } = await import('node:fs/promises')
  const content = await readFile(new URL('../lib/updater.js', import.meta.url), 'utf8')
  assert.equal(
    content.includes('--config.minimumReleaseAge=0'),
    false,
    'updater must not pass --config.minimumReleaseAge=0'
  )
})
