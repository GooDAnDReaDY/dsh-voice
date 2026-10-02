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
  // Polling loop 60 * 500ms = 30s in startWhisper
  assert.match(indexSrc, /for \(let i = 0; i < 60; i\+\+\) \{[\s\S]*?whisperAlive\(\)[\s\S]*?child\.exitCode/, 'startWhisper must poll up to 60 iterations with premature exit check')

  // Polling loop 60 * 500ms = 30s in startSensevoice
  assert.match(indexSrc, /for \(let i = 0; i < 60; i\+\+\) \{[\s\S]*?sensevoiceAlive\(\)[\s\S]*?sensevoiceChild\.exitCode/, 'startSensevoice must poll up to 60 iterations with premature exit check')
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
  } finally {
    globalThis.fetch = origFetch
  }
})

test('startWhisper and startSensevoice support modern DSH 0.2 shell.execute contract (#191)', () => {
  const indexSource = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
  assert.match(indexSource, /ctx\.shell\?\.execute/, 'must support ctx.shell.execute')
  assert.match(indexSource, /child\.done && typeof child\.done\.then === 'function'/, 'must handle ShellExecution.done promise')
  assert.match(indexSource, /child\.status === 'exited' \|\| child\.status === 'failed'/, 'must handle ShellExecution status states')
})

test('startWhisper and startSensevoice release starting flag across all exit paths (#192)', () => {
  const indexSource = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
  // Check that try block begins immediately after starting latch in startWhisper
  assert.match(indexSource, /startingWhisper = true\s*try \{/, 'startWhisper must wrap all checks in try/finally')
  // Check that try block begins immediately after starting latch in startSensevoice
  assert.match(indexSource, /startingSensevoice = true\s*try \{/, 'startSensevoice must wrap all checks in try/finally')
})
