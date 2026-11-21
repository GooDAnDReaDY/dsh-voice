import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { apply, BaseConfig } from '../lib/index.js'

const indexSrc = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')

test('lib/index.js wires autostart to deferred settings injection and updates', () => {
  // 1. triggerAutostart helper exists
  assert.match(indexSrc, /function triggerAutostart\(\)/, 'must define triggerAutostart helper')

  // 2. Called on ctx.inject(['settings']) callback
  assert.match(indexSrc, /ctx\.inject\(\['settings'\], \(sctx\) => \{[\s\S]*?triggerAutostart\(\)/, 'must call triggerAutostart in settings inject')

  // 3. Subscribed to scope.watch
  assert.match(indexSrc, /scope\.watch\(\(\) => \{[\s\S]*?triggerAutostart\(\)/, 'must call triggerAutostart on scope.watch')

  // 4. Subscribed to modern DSH events
  assert.match(indexSrc, /ctx\.on\('loader\/volatile-update', \(\) => triggerAutostart\(\)\)/, 'must listen to loader/volatile-update')
  assert.match(indexSrc, /ctx\.on\('settings\/document-updated', \(\) => triggerAutostart\(\)\)/, 'must listen to settings/document-updated')
  assert.match(indexSrc, /ctx\.on\('config', \(\) => triggerAutostart\(\)\)/, 'must listen to config event')
})

test('startWhisper and startSensevoice delegate to unified spawnAndAwaitDaemon with 30s timeout (#353)', () => {
  const daemonSrc = readFileSync(new URL('../lib/local-daemon.js', import.meta.url), 'utf8')
  // Unified polling loop 60 * 500ms = 30s with aliveFn and premature exit check
  assert.match(daemonSrc, /for \(let i = 0; i < 60; i\+\+\) \{[\s\S]*?aliveFn\(\)[\s\S]*?child\.exitCode/, 'spawnAndAwaitDaemon must poll up to 60 iterations with premature exit check')
  assert.match(daemonSrc, /startWhisper[\s\S]*?spawnAndAwaitDaemon\(\{[\s\S]*?aliveFn:\s*whisperAlive/, 'startWhisper must delegate to spawnAndAwaitDaemon')
  assert.match(daemonSrc, /startSensevoice[\s\S]*?spawnAndAwaitDaemon\(\{[\s\S]*?aliveFn:\s*sensevoiceAlive/, 'startSensevoice must delegate to spawnAndAwaitDaemon')
})

test('autostart dispatch lifecycle executes production apply and responds to settings watch (#214)', async () => {
  let shellExecuted = 0
  let currentConfig = {
    autoStart: false,
    whisperModel: '',
    sensevoiceAutostart: false,
    sensevoiceModel: '',
    whisperUrl: 'http://127.0.0.1:9999',
    sensevoiceUrl: 'http://127.0.0.1:9998',
  }

  const watchListeners = []
  const eventListeners = {}

  const mockCtx = {
    effect: (fn) => fn(),
    inject: (deps, fn) => {
      if (deps.includes('settings')) {
        fn({
          settings: {
            register: () => ({
              get: () => currentConfig,
              watch: (cb) => watchListeners.push(cb),
            }),
          },
          effect: (f) => f(),
        })
      }
    },
    webServer: { register: () => () => {} },
    tools: { register: () => () => {} },
    credentials: { resolve: async () => null },
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    on: (evt, cb) => {
      eventListeners[evt] = cb
    },
    shell: {
      resolve: (spec) => spec,
      execute: () => {
        shellExecuted++
        return {
          done: Promise.resolve(),
          status: 'running',
          kill: () => {},
        }
      },
      start: () => {
        shellExecuted++
        return { kill: () => {} }
      },
    },
  }

  const origFetch = globalThis.fetch
  let pingCount = 0
  globalThis.fetch = async () => {
    pingCount++
    // Return false on first check so it spawns, then true so polling succeeds immediately
    return { ok: pingCount > 1 }
  }

  try {
  // 1. Initial apply with autoStart: false -> no shell executions
  apply(mockCtx, BaseConfig(currentConfig))
  assert.equal(shellExecuted, 0, 'must not execute shell when autoStart is false')

  // 2. Settings update via watch with autoStart: true and whisperModel
  currentConfig = {
    ...currentConfig,
    autoStart: true,
    whisperModel: '/models/whisper-base.bin',
  }
  for (const listener of watchListeners) listener()

  // Wait a microtask tick for async autostart promise
  await new Promise((r) => setTimeout(r, 600))
  assert.ok(shellExecuted >= 1, 'must trigger shell execution on settings watch update')

  // 3. Modern DSH event trigger: loader/volatile-update triggers autostart
  pingCount = 0
  const prevShell = shellExecuted
  currentConfig.autoStart = true
  currentConfig.whisperModel = '/models/whisper-new.bin'
  assert.equal(typeof eventListeners['loader/volatile-update'], 'function', 'loader/volatile-update listener registered')
  assert.equal(typeof eventListeners['settings/document-updated'], 'function', 'settings/document-updated listener registered')
  assert.equal(typeof eventListeners['config'], 'function', 'config listener registered')

  eventListeners['loader/volatile-update']()
  await new Promise((r) => setTimeout(r, 600))
  assert.ok(shellExecuted > prevShell, 'must trigger shell execution on loader/volatile-update')
  } finally {
    globalThis.fetch = origFetch
  }
})

test('startWhisper and startSensevoice support modern DSH 0.2 shell.execute contract (#191)', () => {
  const daemonSource = readFileSync(new URL('../lib/local-daemon.js', import.meta.url), 'utf8')
  assert.match(daemonSource, /ctx\.shell\?\.execute/, 'must support ctx.shell.execute')
  assert.match(daemonSource, /child = await ctx\.shell\.execute/, 'must await ctx.shell.execute Promise (#191)')
  assert.match(daemonSource, /child\.done && typeof child\.done\.then === 'function'/, 'must handle ShellExecution.done promise')
  assert.match(daemonSource, /child\.status === 'exited' \|\| child\.status === 'failed'/, 'must handle ShellExecution status states')
})

test('startWhisper and startSensevoice release starting flag across all exit paths (#192)', () => {
  const daemonSource = readFileSync(new URL('../lib/local-daemon.js', import.meta.url), 'utf8')
  // Check that try block begins immediately after starting latch in startWhisper
  assert.match(daemonSource, /startingWhisper = true\s*try \{/, 'startWhisper must wrap all checks in try/finally')
  // Check that try block begins immediately after starting latch in startSensevoice
  assert.match(daemonSource, /startingSensevoice = true\s*try \{/, 'startSensevoice must wrap all checks in try/finally')
})

test('startWhisper and startSensevoice pass positive finite timeoutMs to shell spec (GH #9, #261)', () => {
  const daemonSource = readFileSync(new URL('../lib/local-daemon.js', import.meta.url), 'utf8')
  // Must NOT use timeoutMs: 0
  assert.doesNotMatch(daemonSource, /timeoutMs:\s*0\b/, 'must not pass timeoutMs: 0 which fails DSH 0.2 shell validation')
  // Must pass positive timeoutMs (e.g. timeoutMs: 60000)
  assert.match(daemonSource, /timeoutMs:\s*[1-9]\d*/, 'must pass positive finite timeoutMs to shell execution spec')
})

test('Issue #353: daemon FSM states are not overwritten by string errors in getters and follow symmetric lifecycle', async () => {
  const { createLocalDaemons, DAEMON_STATES } = await import('../lib/local-daemon.js')

  let cfg = {
    autoStart: true,
    whisperModel: '/models/w.bin',
    whisperBin: 'whisper-server',
    whisperUrl: 'http://127.0.0.1:8001',
    sensevoiceAutostart: true,
    sensevoiceModel: '/models/s.bin',
    sensevoiceUrl: 'http://127.0.0.1:6006',
  }

  let childExitCode = 1
  let shellExecCount = 0

  const mockCtx = {
    on: () => {},
    shell: {
      resolve: (spec) => spec,
      execute: async () => {
        shellExecCount++
        return {
          status: 'failed',
          exitCode: childExitCode,
          done: Promise.resolve({ code: childExitCode }),
          readOutput: () => ({ stderr: 'model failed to load' }),
          kill: () => {},
        }
      },
    },
  }

  const origFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 500 })

  try {
    const daemons = createLocalDaemons({ live: () => cfg, ctx: mockCtx })
    assert.equal(daemons.getWhisperState(), DAEMON_STATES.STOPPED, 'initial whisper state is STOPPED')
    assert.equal(daemons.getSensevoiceState(), DAEMON_STATES.STOPPED, 'initial sensevoice state is STOPPED')

    // Start whisper with failing process
    const okW = await daemons.startWhisper()
    assert.equal(okW, false)
    assert.equal(daemons.getWhisperState(), DAEMON_STATES.CRASHED, 'whisper state transitions to CRASHED on process failure')
    assert.ok(daemons.getWhisperError().includes('exited prematurely') || daemons.getWhisperError().includes('model failed to load'))

    // Start sensevoice with failing process
    const okS = await daemons.startSensevoice()
    assert.equal(okS, false)
    assert.equal(daemons.getSensevoiceState(), DAEMON_STATES.CRASHED, 'sensevoice state transitions to CRASHED on process failure')
    assert.ok(daemons.getSensevoiceError().includes('exited prematurely') || daemons.getSensevoiceError().includes('model failed to load'))

    // Dispose resets both to STOPPED
    daemons.dispose()
    assert.equal(daemons.getWhisperState(), DAEMON_STATES.STOPPED, 'dispose transitions whisper to STOPPED')
    assert.equal(daemons.getSensevoiceState(), DAEMON_STATES.STOPPED, 'dispose transitions sensevoice to STOPPED')
  } finally {
    globalThis.fetch = origFetch
  }
})
