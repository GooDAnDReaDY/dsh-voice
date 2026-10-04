import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import vm from 'node:vm'
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  isTrustedUpdateRequest,
  registerPluginUpdater,
  readLockPid,
  isProcessAlive,
  checkProfileLock,
  formatLockDiagnostic,
} from '../lib/updater.js'

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
    'cross-site must be rejected'
  )

  // Valid local request
  assert.equal(
    isTrustedUpdateRequest({
      headers: {
        'x-dsh-plugin-update': '1',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      socket: { remoteAddress: '127.0.0.1' },
    }),
    true,
    'valid local request must be accepted'
  )
})

test('registerPluginUpdater mounts update route with method checking', async () => {
  let registered = null
  const fakeCtx = {
    webServer: {
      register: (reg) => { registered = reg },
    },
    logger: { warn: () => {} },
  }

  registerPluginUpdater(fakeCtx, {
    endpoint: '/api/dsh-voice/update',
    packageName: '@goodandready/dsh-voice',
  })

  assert.ok(registered, 'endpoint must be registered')
  assert.equal(registered.path, '/api/dsh-voice/update')
  assert.equal(registered.kind, 'exact')

  // PUT method rejected with 405
  let putStatus = null
  await registered.handler({ method: 'PUT' }, {
    writeHead: (s) => { putStatus = s },
    end: () => {},
  })
  assert.equal(putStatus, 405)

  // POST without trust rejected with 403
  let postStatus = null
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

test('package.json.lock lifecycle and process alive detection (#176)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-voice-lock-'))
  const lockFile = join(dir, 'package.json.lock')

  try {
    // 1. No lock file
    assert.deepEqual(checkProfileLock(dir), { locked: false })

    // 2. Lock file with dead PID (e.g. 9999999) -> preserved and reports locked under read-only policy (#205, #83969)
    writeFileSync(lockFile, '9999999', 'utf8')
    const deadCheck = checkProfileLock(dir)
    assert.equal(deadCheck.locked, true)
    assert.equal(deadCheck.pid, 9999999)
    assert.equal(existsSync(lockFile), true, 'stale lock must be preserved without unlink')

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
    try { rmSync(dir, { recursive: true }) } catch { /* ignore */ }
  }
})

test('formatLockDiagnostic formats neutral diagnostics and preserves error code (#205, #84623)', () => {
  assert.equal(formatLockDiagnostic({ locked: false }), null)
  assert.match(formatLockDiagnostic({ locked: true, pid: 1234 }), /PID 1234/)
  assert.match(formatLockDiagnostic({ locked: true, pid: null }), /existing lockfile/)
  assert.match(formatLockDiagnostic({ locked: true, pid: null, error: 'EIO' }), /EIO/)
  assert.match(formatLockDiagnostic({ locked: true, pid: null, error: 'EACCES' }), /EACCES/)
})

test('checkProfileLock fail-closed behavior on EACCES and EIO filesystem errors (#205, #84626)', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-voice-lock-err-'))
  try {
    const src = readFileSync(new URL('../lib/updater.js', import.meta.url), 'utf8')
    const checkSrc = src.slice(
      src.indexOf('export function checkProfileLock('),
      src.indexOf('\nexport function formatLockDiagnostic(')
    ).replace('export ', '')
    for (const code of ['EACCES', 'EIO']) {
      const box = {
        resolve: (d, f) => join(d, f),
        statSync: () => { throw Object.assign(new Error(code), { code }) },
        readLockPid: () => null,
      }
      vm.createContext(box)
      vm.runInContext(checkSrc + ';globalThis.check=checkProfileLock', box)
      const out = box.check(root)
      assert.equal(out.locked, true)
      assert.equal(out.error, code)
    }
  } finally {
    try { rmSync(root, { recursive: true }) } catch { /* ignore */ }
  }
})

test('installExact lifecycle and lock preservation across success, nonzero, spawn error, and timeout escalation (#205, #84626)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-voice-install-lifecycle-'))
  const lock = join(root, 'package.json.lock')
  try {
    const src = readFileSync(new URL('../lib/updater.js', import.meta.url), 'utf8')
    const installSrc = src.slice(
      src.indexOf('async function installExact('),
      src.indexOf('\nfunction json(')
    )

    for (const mode of ['success', 'nonzero', 'spawn-error', 'timeout']) {
      writeFileSync(lock, 'foreign-successor', 'utf8')
      const timers = new Map()
      const kills = []
      let seq = 0
      const sandbox = {
        process,
        UPDATE_TIMEOUT_MS: 600000,
        checkProfileLock: () => ({ locked: false }),
        formatLockDiagnostic: () => null,
        setTimeout: (f, ms) => { const id = ++seq; timers.set(id, f); return id },
        clearTimeout: id => timers.delete(id),
        spawn: () => {
          const child = new EventEmitter()
          child.stdout = new EventEmitter()
          child.stderr = new EventEmitter()
          child.kill = sig => {
            kills.push(sig)
            if (sig === 'SIGKILL') child.emit('exit', null)
          }
          queueMicrotask(() => {
            if (mode === 'success') child.emit('exit', 0)
            if (mode === 'nonzero') child.emit('exit', 2)
            if (mode === 'spawn-error') child.emit('error', new Error('spawn fixture error'))
            if (mode === 'timeout') {
              if (timers.has(1)) timers.get(1)()
              if (timers.has(2)) timers.get(2)()
            }
          })
          return child
        },
      }
      vm.createContext(sandbox)
      vm.runInContext(installSrc + ';globalThis.install=installExact', sandbox)
      let rejected = false
      try {
        await sandbox.install({ cliEntry: '/fixture/cli', profileDir: root, profileName: 'web' }, '@goodandready/dsh-voice@0.9.25', {})
      } catch {
        rejected = true
      }
      assert.equal(rejected, mode !== 'success', `mode ${mode} rejection mismatch`)
      assert.equal(readFileSync(lock, 'utf8'), 'foreign-successor', 'foreign lock must be preserved')
      assert.equal(timers.size, 0, 'all timers must be cleaned up')
      assert.equal(kills.length, mode === 'timeout' ? 2 : 0, 'timeout must trigger SIGTERM and SIGKILL')
      if (mode === 'timeout') {
        assert.deepEqual(kills, ['SIGTERM', 'SIGKILL'])
      }
    }
  } finally {
    try { rmSync(root, { recursive: true }) } catch { /* ignore */ }
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

test('updater source code awaits child exit and escalates SIGTERM to SIGKILL on timeout (#206)', async () => {
  const { readFile } = await import('node:fs/promises')
  const updaterSrc = await readFile(new URL('../lib/updater.js', import.meta.url), 'utf8')
  assert.ok(updaterSrc.includes("child.kill('SIGTERM')"), 'must send SIGTERM on timeout')
  assert.ok(updaterSrc.includes("child.kill('SIGKILL')"), 'must escalate to SIGKILL on timeout')
  assert.ok(updaterSrc.includes("if (timedOut)"), 'must defer rejection until child exit event fires')
})
