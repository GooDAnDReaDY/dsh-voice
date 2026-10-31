// lib/supervisor.js — Process Supervisor and Lifecycle Finite State Machine (#310)

export const DAEMON_STATES = Object.freeze({
  STOPPED: 'STOPPED',
  STARTING: 'STARTING',
  RUNNING: 'RUNNING',
  DEGRADED: 'DEGRADED',
  CRASHED: 'CRASHED',
  RESTARTING: 'RESTARTING',
})

const VALID_TRANSITIONS = {
  STOPPED: new Set(['STARTING', 'RUNNING', 'STOPPED']),
  STARTING: new Set(['RUNNING', 'CRASHED', 'DEGRADED', 'STOPPED']),
  RUNNING: new Set(['DEGRADED', 'CRASHED', 'RESTARTING', 'STOPPED', 'RUNNING']),
  DEGRADED: new Set(['RUNNING', 'CRASHED', 'RESTARTING', 'STOPPED']),
  CRASHED: new Set(['STARTING', 'RESTARTING', 'RUNNING', 'STOPPED']),
  RESTARTING: new Set(['STARTING', 'RUNNING', 'CRASHED', 'STOPPED']),
}

export class ProcessSupervisor {
  /**
   * @param {{
   *   name: string,
   *   healthcheck?: () => Promise<boolean>,
   *   heartbeatMs?: number
   * }} options
   */
  constructor(options = {}) {
    this.name = options.name || 'daemon'
    this.state = DAEMON_STATES.STOPPED
    this.lastError = null
    this.crashCount = 0
    this.startedAt = null
    this.updatedAt = Date.now()
    this.handle = null
    this.disposed = false
    this.healthcheck = typeof options.healthcheck === 'function' ? options.healthcheck : null
    this.heartbeatMs = typeof options.heartbeatMs === 'number' && options.heartbeatMs > 0 ? options.heartbeatMs : 0
    this._timer = null
    this._listeners = new Set()
    this.history = [{ state: this.state, reason: 'init', at: this.updatedAt }]
  }

  canTransition(nextState) {
    const allowed = VALID_TRANSITIONS[this.state]
    return allowed ? allowed.has(nextState) : false
  }

  transition(nextState, reason = '') {
    if (!DAEMON_STATES[nextState]) {
      throw new Error(`Invalid daemon state: ${nextState}`)
    }
    const prev = this.state
    this.state = nextState
    this.updatedAt = Date.now()
    if (nextState === DAEMON_STATES.RUNNING) {
      this.lastError = null
      if (!this.startedAt) this.startedAt = this.updatedAt
    } else if (nextState === DAEMON_STATES.CRASHED || nextState === DAEMON_STATES.DEGRADED) {
      if (reason) this.lastError = reason
      if (nextState === DAEMON_STATES.CRASHED) this.crashCount++
    } else if (nextState === DAEMON_STATES.STOPPED) {
      this.startedAt = null
    }
    const entry = { from: prev, state: nextState, reason: reason || '', at: this.updatedAt }
    this.history.push(entry)
    if (this.history.length > 30) this.history.shift()
    for (const fn of this._listeners) {
      try { fn(entry) } catch { /* ignore listener errors */ }
    }
    return this.state
  }

  onStateChange(listener) {
    if (typeof listener !== 'function') return () => {}
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  attachHandle(handle) {
    this.handle = handle
    if (handle && typeof handle.on === 'function') {
      handle.on('error', (err) => {
        if (!this.disposed) {
          this.transition(DAEMON_STATES.CRASHED, err?.message || String(err))
        }
      })
      handle.on('exit', (code, signal) => {
        if (!this.disposed && code !== 0 && code !== null) {
          this.transition(DAEMON_STATES.CRASHED, `${this.name} process exited (${code ?? signal})`)
        } else if (!this.disposed && this.state === DAEMON_STATES.RUNNING) {
          this.transition(DAEMON_STATES.STOPPED, 'process exited cleanly')
        }
      })
    }
    return handle
  }

  startHeartbeat() {
    this.stopHeartbeat()
    if (!this.healthcheck || this.heartbeatMs <= 0 || this.disposed) return
    this._timer = setInterval(async () => {
      if (this.disposed || (this.state !== DAEMON_STATES.RUNNING && this.state !== DAEMON_STATES.DEGRADED)) return
      try {
        const ok = await this.healthcheck()
        if (!ok && this.state === DAEMON_STATES.RUNNING) {
          this.transition(DAEMON_STATES.DEGRADED, `${this.name} healthcheck failed`)
        } else if (ok && this.state === DAEMON_STATES.DEGRADED) {
          this.transition(DAEMON_STATES.RUNNING, `${this.name} healthcheck recovered`)
        }
      } catch (err) {
        if (this.state === DAEMON_STATES.RUNNING) {
          this.transition(DAEMON_STATES.DEGRADED, err?.message || String(err))
        }
      }
    }, this.heartbeatMs)
    if (this._timer && typeof this._timer.unref === 'function') {
      this._timer.unref()
    }
  }

  stopHeartbeat() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  }

  killHandle() {
    if (this.handle && typeof this.handle.kill === 'function') {
      try { this.handle.kill() } catch { /* ignore */ }
    }
    this.handle = null
  }

  dispose() {
    this.disposed = true
    this.stopHeartbeat()
    this.killHandle()
    this.transition(DAEMON_STATES.STOPPED, 'disposed')
  }

  snapshot() {
    return {
      name: this.name,
      state: this.state,
      lastError: this.lastError,
      crashCount: this.crashCount,
      startedAt: this.startedAt,
      updatedAt: this.updatedAt,
    }
  }
}
