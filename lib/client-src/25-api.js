    // Centralized API Client / DAO layer for all backend HTTP and WebSocket calls (#307)
    const apiClient = {
      getTokenHeaders() {
        return typeof window !== 'undefined' && window.__dshVoiceToken
          ? { 'x-dsh-voice-token': window.__dshVoiceToken }
          : {}
      },
      getStatus(opts = {}) {
        return fetch('/dsh-voice/status', { cache: 'no-store', ...opts })
      },
      getConfig() {
        return fetch('/dsh-voice/config', { cache: 'no-store' })
      },
      putConfig(payload) {
        return fetch('/dsh-voice/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...this.getTokenHeaders() },
          body: JSON.stringify(payload),
        })
      },
      transcribe(payload, opts = {}) {
        return fetch('/dsh-voice/transcribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...this.getTokenHeaders() },
          body: JSON.stringify(payload),
          signal: opts.signal,
        })
      },
      polish(payload) {
        return fetch('/dsh-voice/polish', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...this.getTokenHeaders() },
          body: JSON.stringify(payload),
        })
      },
      getSensevoiceInstaller() {
        return fetch('/dsh-voice/sensevoice-installer')
      },
      installSensevoice(modelType = 'sensevoice') {
        return fetch('/dsh-voice/sensevoice-installer', {
          method: 'POST',
          headers: {
            'x-dsh-plugin-update': '1',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: modelType }),
        })
      },
      getUpdateStatus() {
        return fetch('/api/dsh-voice/update', {
          headers: { accept: 'application/json' },
          cache: 'no-store',
        })
      },
      triggerUpdate() {
        return fetch('/api/dsh-voice/update', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-dsh-plugin-update': '1',
          },
          cache: 'no-store',
        })
      },
      runBenchmark() {
        return fetch('/dsh-voice/benchmark', {
          method: 'POST',
          headers: {
            'x-dsh-plugin-update': '1',
            'Content-Type': 'application/json',
          },
        })
      },
      exportDiagnostics() {
        return fetch('/dsh-voice/diagnostics/export')
      },
      openWebSocket(url) {
        return new WebSocket(url)
      },
    }
