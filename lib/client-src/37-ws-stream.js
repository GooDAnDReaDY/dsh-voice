// lib/client-src/37-ws-stream.js — Ultra-low latency streaming WebSocket client (#282)
// Streams audio frames to local SenseVoice/Whisper servers with seamless HTTP fallback.

function isWsStreamingSupported() {
  return typeof WebSocket !== 'undefined'
}

class ASRWebSocketStream {
  constructor(options = {}) {
    this.options = options
    this.ws = null
    this.isOpen = false
    this.onInterim = options.onInterim || null
    this.onFinal = options.onFinal || null
    this.onError = options.onError || null
    this._finalPromise = null
    this._resolveFinal = null
  }

  async connect(mimeType = 'audio/webm', mode = 'dictation') {
    if (!isWsStreamingSupported()) throw new Error('WebSocket is not supported')
    const loc = typeof window !== 'undefined' ? window.location : null
    if (!loc) throw new Error('Window location unavailable')

    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:'
    const token = typeof window !== 'undefined' && window.__dshVoiceToken ? window.__dshVoiceToken : ''
    const url = `${proto}//${loc.host}/dsh-voice/ws/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`

    return new Promise((resolve, reject) => {
      let settled = false
      try {
        this.ws = new WebSocket(url)
      } catch (err) {
        return reject(err)
      }

      this.ws.onopen = () => {
        this.isOpen = true
        this.ws.send(JSON.stringify({ type: 'init', mimeType, mode }))
        if (!settled) { settled = true; resolve(this) }
      }

      this.ws.onerror = (e) => {
        if (!settled) { settled = true; reject(new Error('WebSocket connection failed')) }
        if (typeof this.onError === 'function') this.onError(e)
      }

      this.ws.onclose = () => {
        this.isOpen = false
        if (!settled) { settled = true; reject(new Error('WebSocket closed unexpectedly')) }
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'interim' && msg.text && typeof this.onInterim === 'function') {
            this.onInterim(msg.text)
          } else if (msg.type === 'final') {
            if (typeof this.onFinal === 'function') this.onFinal(msg)
            if (this._resolveFinal) {
              this._resolveFinal(msg)
              this._resolveFinal = null
            }
          }
        } catch (_) {}
      }
    })
  }

  sendBlobChunk(blob) {
    if (!this.isOpen || !this.ws || this.ws.readyState !== WebSocket.OPEN) return false
    blob.arrayBuffer().then((buffer) => {
      if (this.isOpen && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(buffer)
      }
    }).catch(() => {})
    return true
  }

  requestInterim() {
    if (!this.isOpen || !this.ws || this.ws.readyState !== WebSocket.OPEN) return
    try { this.ws.send(JSON.stringify({ type: 'interim' })) } catch (_) {}
  }

  finish() {
    if (!this.isOpen || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.resolve(null)
    }
    this._finalPromise = new Promise((resolve) => {
      this._resolveFinal = resolve
      setTimeout(() => resolve(null), 8000)
    })
    try {
      this.ws.send(JSON.stringify({ type: 'finish' }))
    } catch (_) {
      return Promise.resolve(null)
    }
    return this._finalPromise
  }

  close() {
    this.isOpen = false
    if (this.ws) {
      try { this.ws.close() } catch (_) {}
      this.ws = null
    }
  }
}

voice.streamingWs = {
  isSupported: isWsStreamingSupported,
  createStream: (options) => new ASRWebSocketStream(options),
}
