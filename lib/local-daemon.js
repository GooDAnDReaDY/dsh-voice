// lib/local-daemon.js — Local background process daemon management for whisper and sensevoice
import { isAutoLang } from './provider-http.js'
import { ProcessSupervisor, DAEMON_STATES } from './supervisor.js'
export { ProcessSupervisor, DAEMON_STATES }
import { buildSensevoiceArgs } from './sensevoice-installer.js'

function extractChildDetail(child, ctx) {
  let detail = ''
  if (!child) return detail
  if (typeof child.readOutput === 'function') {
    try {
      const out = child.readOutput()
      if (out && out.stderr) detail = String(out.stderr).trim()
      else if (out && out.stdout) detail = String(out.stdout).trim()
    } catch (err) {
      if (ctx?.logger?.debug) ctx.logger.debug('[dsh-voice:local-daemon] error reading child.readOutput:', err?.message || err)
    }
  } else if (typeof child.read === 'function') {
    try {
      const out = child.read()
      if (out && out.stderr) detail = String(out.stderr).trim()
    } catch (err) {
      if (ctx?.logger?.debug) ctx.logger.debug('[dsh-voice:local-daemon] error reading child.read:', err?.message || err)
    }
  }
  return detail
}

export async function spawnAndAwaitDaemon({
  name,
  command,
  aliveFn,
  supervisor,
  previousChild = null,
  ctx = null,
  getDisposed = () => false,
  onError = () => {},
}) {
  if (previousChild && typeof previousChild.kill === 'function') {
    try { previousChild.kill() } catch { /* ignore */ }
  }

  supervisor.transition(DAEMON_STATES.STARTING, `spawning ${name}`)

  const specOpts = { command, onExpiry: 'none', timeoutMs: 60000, stdoutMaxBytes: 4 * 1024 * 1024 }
  const spec = typeof ctx?.shell?.resolve === 'function' ? ctx.shell.resolve(specOpts) : specOpts

  let child = null
  if (typeof ctx.shell?.execute === 'function') {
    child = await ctx.shell.execute(spec)
  } else if (typeof ctx.shell?.start === 'function') {
    child = await ctx.shell.start(spec)
  }

  if (getDisposed()) {
    if (child && typeof child.kill === 'function') {
      try { child.kill() } catch { /* ignore */ }
    }
    return { ok: false, child: null, error: null }
  }

  const recordError = (msg) => {
    if (typeof onError === 'function') onError(msg)
  }

  if (child && typeof child.on === 'function') {
    child.on('error', (err) => {
      recordError(err?.message || String(err))
    })
    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        recordError(`${name} process exited with code ${code}`)
      }
    })
  }

  if (child && child.done && typeof child.done.then === 'function') {
    child.done.then(async (res) => {
      let code = res && res.code
      let detail = extractChildDetail(child, ctx)
      if (typeof child.result === 'function') {
        try {
          const r = await child.result()
          if (r) {
            if (r.exitCode !== undefined && r.exitCode !== null) code = r.exitCode
            if (r.stderr && !detail) detail = String(r.stderr).trim()
          }
        } catch (err) {
          const msg = err && err.message ? err.message : String(err)
          if (msg && !detail) detail = msg.trim()
        }
      } else if (child.result && typeof child.result === 'object') {
        code = child.result.exitCode ?? code
        if (child.result.stderr && !detail) detail = String(child.result.stderr).trim()
      }
      if (child.status === 'killed') {
        recordError(detail ? `${name} process was killed: ${detail}` : `${name} process was killed`)
      } else if (child.status === 'completed') {
        code = code ?? child.exitCode ?? 0
        if (code !== 0 && code !== null && code !== undefined) {
          recordError(`${name} process exited with code ${code}${detail ? `: ${detail}` : ''}`)
        }
      } else if (code !== 0 && code !== null && code !== undefined) {
        recordError(`${name} process exited with code ${code}${detail ? `: ${detail}` : ''}`)
      }
    }).catch((err) => {
      recordError(err?.message || String(err))
    })
  }

  // Wait for it to become healthy (up to 30s).
  for (let i = 0; i < 60; i++) {
    if (getDisposed()) return { ok: false, child, error: null }
    await new Promise((r) => setTimeout(r, 500))
    if (getDisposed()) return { ok: false, child, error: null }
    if (await aliveFn()) {
      supervisor.attachHandle(child)
      supervisor.transition(DAEMON_STATES.RUNNING, 'healthcheck passed')
      return { ok: true, child, error: null }
    }
    if (child) {
      let detail = extractChildDetail(child, ctx)
      let code = child.exitCode
      const isTerminal = (child.status && child.status !== 'running') || (code !== null && code !== undefined)
      if (isTerminal) {
        if (typeof child.result === 'function') {
          try {
            const r = await child.result()
            if (r) {
              if (r.exitCode !== undefined && r.exitCode !== null) code = r.exitCode
              if (r.stderr && !detail) detail = String(r.stderr).trim()
            }
          } catch (err) {
            const msg = err && err.message ? err.message : String(err)
            if (msg && !detail) detail = msg.trim()
          }
        } else if (child.result && typeof child.result === 'object') {
          code = child.result.exitCode ?? code
          if (child.result.stderr && !detail) detail = String(child.result.stderr).trim()
        }
        let errMsg = ''
        if (child.status === 'killed') {
          errMsg = detail ? `${name} process was killed: ${detail}` : `${name} process was killed`
        } else if (child.status === 'completed') {
          code = code ?? 0
          errMsg = `${name} process exited prematurely with code ${code}${detail ? `: ${detail}` : ''}`
        } else if (child.status === 'exited' || child.status === 'failed') {
          errMsg = `${name} process exited prematurely with status ${child.status}${detail ? `: ${detail}` : ''}`
        } else if (child.exitCode !== null && child.exitCode !== undefined) {
          errMsg = `${name} process exited prematurely with code ${child.exitCode}${detail ? `: ${detail}` : ''}`
        }
        recordError(errMsg)
        supervisor.transition(DAEMON_STATES.CRASHED, errMsg || `${name} process exited prematurely`)
        return { ok: false, child, error: errMsg }
      }
    }
  }

  const timeoutErr = `${name} process started but failed health check`
  recordError(timeoutErr)
  supervisor.transition(DAEMON_STATES.DEGRADED, timeoutErr)
  return { ok: false, child, error: timeoutErr }
}

export function createLocalDaemons({ live, ctx }) {
  let child = null
  let whisperError = null
  let startingWhisper = false
  let disposed = false
  const whisperSupervisor = new ProcessSupervisor({ name: 'whisper', healthcheck: () => whisperAlive() })
  const sensevoiceSupervisor = new ProcessSupervisor({ name: 'sensevoice', healthcheck: () => sensevoiceAlive() })
  if (ctx && typeof ctx.on === 'function') {
    try { ctx.on('dispose', () => dispose()) } catch { /* ignore */ }
  }

  async function whisperAlive() {
    const rawUrl = String(live().whisperUrl || '').trim()
    const base = rawUrl.includes('/inference') ? rawUrl.split('/inference')[0] : rawUrl.replace(/\/+$/, '')
    if (!base) return false
    try {
      const res = await fetch(base + '/', { signal: AbortSignal.timeout(2000) })
      return res.ok
    } catch {
      return false
    }
  }

  async function startWhisper() {
    if (startingWhisper || disposed) return false
    startingWhisper = true
    try {
      const cfg = live()
      if (!cfg.autoStart) return false
      if (!cfg.whisperModel) return false
      if (await whisperAlive()) {
        whisperError = null
        whisperSupervisor.transition(DAEMON_STATES.RUNNING, 'already alive')
        return true
      }
      const rawLang = cfg?.dictation?.language
      const safeLang = isAutoLang(rawLang) ? 'auto' : String(rawLang || '').replace(/[^a-zA-Z0-9_-]/g, '') || 'auto'
      const command = `${JSON.stringify(cfg.whisperBin)} -m ${JSON.stringify(cfg.whisperModel)}`
        + ` --host 127.0.0.1 --port 8001 -t 8 -p 1 -l ${JSON.stringify(safeLang)}`

      const res = await spawnAndAwaitDaemon({
        name: 'whisper server',
        command,
        aliveFn: whisperAlive,
        supervisor: whisperSupervisor,
        previousChild: child,
        ctx,
        getDisposed: () => disposed,
        onError: (err) => { whisperError = err },
      })
      child = res.child
      if (res.ok) {
        whisperError = null
        return true
      }
      return false
    } catch (err) {
      whisperError = String(err && err.message ? err.message : err)
      whisperSupervisor.transition(DAEMON_STATES.CRASHED, whisperError)
      return false
    } finally {
      startingWhisper = false
    }
  }

  let sensevoiceChild = null
  let sensevoiceError = null
  let startingSensevoice = false

  async function sensevoiceAlive() {
    const cfg = live()
    const base = String(cfg.sensevoiceUrl || '').replace(/\/api\/.*$/, '').replace(/\/v1\/.*$/, '').replace(/\/+$/, '')
    if (!base) return false
    try {
      const res = await fetch(base + '/', { signal: AbortSignal.timeout(2000) })
      return res.ok || res.status === 404
    } catch {
      return false
    }
  }

  async function startSensevoice() {
    if (startingSensevoice || disposed) return false
    startingSensevoice = true
    try {
      const cfg = live()
      if (!cfg.sensevoiceAutostart) return false
      if (!cfg.sensevoiceModel) return false
      if (await sensevoiceAlive()) {
        sensevoiceError = null
        sensevoiceSupervisor.transition(DAEMON_STATES.RUNNING, 'already alive')
        return true
      }
      const command = buildSensevoiceArgs(cfg)
      const res = await spawnAndAwaitDaemon({
        name: 'sensevoice',
        command,
        aliveFn: sensevoiceAlive,
        supervisor: sensevoiceSupervisor,
        previousChild: sensevoiceChild,
        ctx,
        getDisposed: () => disposed,
        onError: (err) => { sensevoiceError = err },
      })
      sensevoiceChild = res.child
      if (res.ok) {
        sensevoiceError = null
        return true
      }
      return false
    } catch (err) {
      sensevoiceError = String(err && err.message ? err.message : err)
      sensevoiceSupervisor.transition(DAEMON_STATES.CRASHED, sensevoiceError)
      return false
    } finally {
      startingSensevoice = false
    }
  }

  function triggerAutostart() {
    startWhisper().catch((err) => {
      ctx.logger?.debug?.('whisper autostart failed: %s', err?.message || err)
    })
    startSensevoice().catch((err) => {
      ctx.logger?.debug?.('sensevoice autostart failed: %s', err?.message || err)
    })
  }

  function dispose() {
    disposed = true
    whisperSupervisor.dispose()
    sensevoiceSupervisor.dispose()
    if (child && typeof child.kill === 'function') {
      try { child.kill() } catch { /* ignore */ }
      child = null
    }
    if (sensevoiceChild && typeof sensevoiceChild.kill === 'function') {
      try { sensevoiceChild.kill() } catch { /* ignore */ }
      sensevoiceChild = null
    }
  }

  return {
    whisperAlive,
    startWhisper,
    getWhisperError: () => whisperError,
    getWhisperState: () => whisperSupervisor.state,
    whisperSupervisor,
    sensevoiceAlive,
    startSensevoice,
    getSensevoiceError: () => sensevoiceError,
    getSensevoiceState: () => sensevoiceSupervisor.state,
    sensevoiceSupervisor,
    triggerAutostart,
    dispose,
  }
}
