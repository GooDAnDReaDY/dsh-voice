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

test('startWhisper and startSensevoice have 30s timeout and premature exit guards', () => {
  const daemonSrc = readFileSync(new URL('../lib/local-daemon.js', import.meta.url), 'utf8')
  // Polling loop 60 * 500ms = 30s in startWhisper
  assert.match(daemonSrc, /for \(let i = 0; i < 60; i\+\+\) \{[\s\S]*?whisperAlive\(\)[\s\S]*?child\.exitCode/, 'startWhisper must poll up to 60 iterations with premature exit check')

  // Polling loop 60 * 500ms = 30s in startSensevoice
  assert.match(daemonSrc, /for \(let i = 0; i < 60; i\+\+\) \{[\s\S]*?sensevoiceAlive\(\)[\s\S]*?sensevoiceChild\.exitCode/, 'startSensevoice must poll up to 60 iterations with premature exit check')
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
