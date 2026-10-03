// lib/local-daemon.js — Local background process daemon management for whisper and sensevoice
import { isAutoLang } from './provider-http.js'
import { buildSensevoiceArgs } from './sensevoice-installer.js'

export function createLocalDaemons({ live, ctx }) {
  let child = null
  let whisperError = null
  let startingWhisper = false
  let disposed = false

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
        return true
      }
      if (child && typeof child.kill === 'function') {
        try { child.kill() } catch { /* ignore */ }
        child = null
      }
      const command = `${JSON.stringify(cfg.whisperBin)} -m ${JSON.stringify(cfg.whisperModel)}`
        + ` --host 127.0.0.1 --port 8001 -t 8 -p 1 -l ${isAutoLang(cfg.dictation.language) ? 'auto' : cfg.dictation.language}`
      const specOpts = { command, onExpiry: 'none', timeoutMs: 0, stdoutMaxBytes: 4 * 1024 * 1024 }
      const spec = typeof ctx.shell?.resolve === 'function' ? ctx.shell.resolve(specOpts) : specOpts

      if (typeof ctx.shell?.execute === 'function') {
        child = await ctx.shell.execute(spec)
      } else if (typeof ctx.shell?.start === 'function') {
        child = await ctx.shell.start(spec)
      }

      if (disposed) {
        if (child && typeof child.kill === 'function') {
          try { child.kill() } catch { /* ignore */ }
          child = null
        }
        return false
      }

      if (child && typeof child.on === 'function') {
        child.on('error', (err) => {
          whisperError = err?.message || String(err)
        })
        child.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            whisperError = `whisper server process exited with code ${code}`
          }
        })
      }
      if (child && child.done && typeof child.done.then === 'function') {
        child.done.then(async (res) => {
          let code = res && res.code
          let detail = ''
          if (typeof child.result === 'function') {
            try {
              const r = await child.result()
              if (r) {
                if (r.exitCode !== undefined && r.exitCode !== null) code = r.exitCode
                if (r.stderr) detail = String(r.stderr).trim()
              }
            } catch (_) {}
          } else if (child.result && typeof child.result === 'object') {
            code = child.result.exitCode ?? code
            if (child.result.stderr) detail = String(child.result.stderr).trim()
          }
          if (child.status === 'killed') {
            whisperError = detail ? `whisper server process was killed: ${detail}` : 'whisper server process was killed'
          } else if (child.status === 'completed') {
            code = code ?? child.exitCode ?? 0
            if (code !== 0 && code !== null && code !== undefined) {
              whisperError = `whisper server process exited with code ${code}${detail ? `: ${detail}` : ''}`
            }
          } else if (code !== 0 && code !== null && code !== undefined) {
            whisperError = `whisper server process exited with code ${code}${detail ? `: ${detail}` : ''}`
          }
        }).catch((err) => {
          whisperError = err?.message || String(err)
        })
      }

      // Wait for it to become healthy (up to 30s for cold model loading on Metal/CPU).
      for (let i = 0; i < 60; i++) {
        if (disposed) return false
        await new Promise((r) => setTimeout(r, 500))
        if (disposed) return false
        if (await whisperAlive()) {
          whisperError = null
          return true
        }
        if (child) {
          let detail = ''
          if (typeof child.read === 'function') {
            try {
              const out = child.read()
              if (out && out.stderr) detail = String(out.stderr).trim()
            } catch (_) {}
          }
          if (child.status === 'killed') {
            whisperError = detail ? `whisper server process was killed: ${detail}` : 'whisper server process was killed'
            return false
          }
          if (child.status === 'completed') {
            let code = child.exitCode
            if (typeof child.result === 'function') {
              try {
                const r = await child.result()
                if (r) {
                  if (r.exitCode !== undefined && r.exitCode !== null) code = r.exitCode
                  if (r.stderr && !detail) detail = String(r.stderr).trim()
                }
              } catch (_) {}
            } else if (child.result && typeof child.result === 'object') {
              code = child.result.exitCode ?? code
              if (child.result.stderr && !detail) detail = String(child.result.stderr).trim()
            }
            code = code ?? 0
            whisperError = `whisper server process exited prematurely with code ${code}${detail ? `: ${detail}` : ''}`
            return false
          }
          if (child.status === 'exited' || child.status === 'failed') {
            whisperError = `whisper server process exited prematurely with status ${child.status}${detail ? `: ${detail}` : ''}`
            return false
          }
          if (child.exitCode !== null && child.exitCode !== undefined) {
            whisperError = `whisper server process exited prematurely with code ${child.exitCode}${detail ? `: ${detail}` : ''}`
            return false
          }
        }
      }
      whisperError = 'whisper server process started but failed health check on port 8001'
      return false
    } catch (err) {
      whisperError = String(err && err.message ? err.message : err)
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
        return true
      }
      if (sensevoiceChild && typeof sensevoiceChild.kill === 'function') {
        try { sensevoiceChild.kill() } catch { /* ignore */ }
        sensevoiceChild = null
      }
      let port = '6006'
      try { port = new URL(cfg.sensevoiceUrl).port || '6006' } catch { /* invalid URL */ }
      const cmdArgs = buildSensevoiceArgs(cfg, port)
      const commandStr = `${JSON.stringify(cfg.sensevoiceBin)}${cmdArgs}`
      const specOpts = { command: commandStr, onExpiry: 'none', timeoutMs: 0, stdoutMaxBytes: 4 * 1024 * 1024 }
      const spec = typeof ctx.shell?.resolve === 'function' ? ctx.shell.resolve(specOpts) : specOpts

      if (typeof ctx.shell?.execute === 'function') {
        sensevoiceChild = await ctx.shell.execute(spec)
      } else if (typeof ctx.shell?.start === 'function') {
        sensevoiceChild = await ctx.shell.start(spec)
      }

      if (disposed) {
        if (sensevoiceChild && typeof sensevoiceChild.kill === 'function') {
          try { sensevoiceChild.kill() } catch { /* ignore */ }
          sensevoiceChild = null
        }
        return false
      }

      if (sensevoiceChild && typeof sensevoiceChild.on === 'function') {
        sensevoiceChild.on('error', (err) => {
          sensevoiceError = err?.message || String(err)
        })
        sensevoiceChild.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            sensevoiceError = `sensevoice process exited with code ${code}`
          }
        })
      }
      if (sensevoiceChild && sensevoiceChild.done && typeof sensevoiceChild.done.then === 'function') {
        sensevoiceChild.done.then(async (res) => {
          let code = res && res.code
          let detail = ''
          if (typeof sensevoiceChild.result === 'function') {
            try {
              const r = await sensevoiceChild.result()
              if (r) {
                if (r.exitCode !== undefined && r.exitCode !== null) code = r.exitCode
                if (r.stderr) detail = String(r.stderr).trim()
              }
            } catch (_) {}
          } else if (sensevoiceChild.result && typeof sensevoiceChild.result === 'object') {
            code = sensevoiceChild.result.exitCode ?? code
            if (sensevoiceChild.result.stderr) detail = String(sensevoiceChild.result.stderr).trim()
          }
          if (sensevoiceChild.status === 'killed') {
            sensevoiceError = detail ? `sensevoice process was killed: ${detail}` : 'sensevoice process was killed'
          } else if (sensevoiceChild.status === 'completed') {
            code = code ?? sensevoiceChild.exitCode ?? 0
            if (code !== 0 && code !== null && code !== undefined) {
              sensevoiceError = `sensevoice process exited with code ${code}${detail ? `: ${detail}` : ''}`
            }
          } else if (code !== 0 && code !== null && code !== undefined) {
            sensevoiceError = `sensevoice process exited with code ${code}${detail ? `: ${detail}` : ''}`
          }
        }).catch((err) => {
          sensevoiceError = err?.message || String(err)
        })
      }

      // Wait for it to become healthy (up to 30s).
      for (let i = 0; i < 60; i++) {
        if (disposed) return false
        await new Promise((r) => setTimeout(r, 500))
        if (disposed) return false
        if (await sensevoiceAlive()) {
          sensevoiceError = null
          return true
        }
        if (sensevoiceChild) {
          if (sensevoiceChild.status === 'killed') {
            sensevoiceError = 'sensevoice process was killed'
            return false
          }
          if (sensevoiceChild.status === 'completed') {
            const code = sensevoiceChild.result?.exitCode ?? sensevoiceChild.exitCode ?? 0
            sensevoiceError = `sensevoice process exited prematurely with code ${code}`
            return false
          }
          if (sensevoiceChild.status === 'exited' || sensevoiceChild.status === 'failed') {
            sensevoiceError = `sensevoice process exited prematurely with status ${sensevoiceChild.status}`
            return false
          }
          if (sensevoiceChild.exitCode !== null && sensevoiceChild.exitCode !== undefined) {
            sensevoiceError = `sensevoice process exited prematurely with code ${sensevoiceChild.exitCode}`
            return false
          }
        }
      }
      sensevoiceError = 'sensevoice process started but failed health check'
      return false
    } catch (err) {
      sensevoiceError = String(err && err.message ? err.message : err)
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
    sensevoiceAlive,
    startSensevoice,
    getSensevoiceError: () => sensevoiceError,
    triggerAutostart,
    dispose,
  }
}
