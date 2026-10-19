// Pure Node.js RFC 6455 WebSocket framer & upgrade handler with zero dependencies.
import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

export function computeAcceptKey(key) {
  return crypto.createHash('sha1').update(String(key || '') + WS_GUID).digest('base64')
}

export function createWsFrame(data, opcode = 0x01) {
  const isBinary = Buffer.isBuffer(data)
  const payload = isBinary ? data : Buffer.from(String(data || ''), 'utf8')
  const op = isBinary ? 0x02 : opcode
  const len = payload.length

  let header
  if (len <= 125) {
    header = Buffer.alloc(2)
    header[0] = 0x80 | (op & 0x0f)
    header[1] = len
  } else if (len <= 65535) {
    header = Buffer.alloc(4)
    header[0] = 0x80 | (op & 0x0f)
    header[1] = 126
    header.writeUInt16BE(len, 2)
  } else {
    header = Buffer.alloc(10)
    header[0] = 0x80 | (op & 0x0f)
    header[1] = 127
    header.writeBigUInt64BE(BigInt(len), 2)
  }
  return Buffer.concat([header, payload])
}

export class WsConnection extends EventEmitter {
  constructor(socket) {
    super()
    this.socket = socket
    this.readyState = 1 // OPEN
    this._buffer = Buffer.alloc(0)

    socket.on('data', (chunk) => this._onData(chunk))
    socket.on('close', () => {
      this.readyState = 3
      this.emit('close')
    })
    socket.on('error', (err) => {
      this.emit('error', err)
    })
  }

  send(data) {
    if (this.readyState !== 1 || !this.socket.writable) return false
    try {
      this.socket.write(createWsFrame(data))
      return true
    } catch (e) {
      this.emit('error', e)
      return false
    }
  }

  close(code = 1000, reason = '') {
    if (this.readyState !== 1) return
    this.readyState = 2 // CLOSING
    try {
      const reasonBuf = Buffer.from(reason, 'utf8')
      const payload = Buffer.alloc(2 + reasonBuf.length)
      payload.writeUInt16BE(code, 0)
      reasonBuf.copy(payload, 2)
      this.socket.write(createWsFrame(payload, 0x08))
      this.socket.end()
    } catch (_) {
      try { this.socket.destroy() } catch (_) {}
    }
    this.readyState = 3
  }

  _onData(chunk) {
    this._buffer = Buffer.concat([this._buffer, chunk])
    while (this._buffer.length >= 2) {
      const b0 = this._buffer[0]
      const b1 = this._buffer[1]
      const opcode = b0 & 0x0f
      const isMasked = (b1 & 0x80) !== 0
      let payloadLen = b1 & 0x7f
      let offset = 2

      if (payloadLen === 126) {
        if (this._buffer.length < offset + 2) break
        payloadLen = this._buffer.readUInt16BE(offset)
        offset += 2
      } else if (payloadLen === 127) {
        if (this._buffer.length < offset + 8) break
        payloadLen = Number(this._buffer.readBigUInt64BE(offset))
        offset += 8
      }

      let maskKey = null
      if (isMasked) {
        if (this._buffer.length < offset + 4) break
        maskKey = this._buffer.slice(offset, offset + 4)
        offset += 4
      }

      if (this._buffer.length < offset + payloadLen) break
      const rawPayload = this._buffer.slice(offset, offset + payloadLen)
      this._buffer = this._buffer.slice(offset + payloadLen)

      let payload = rawPayload
      if (maskKey) {
        payload = Buffer.alloc(rawPayload.length)
        for (let i = 0; i < rawPayload.length; i++) {
          payload[i] = rawPayload[i] ^ maskKey[i % 4]
        }
      }

      if (opcode === 0x08) { // CLOSE
        this.close()
        break
      } else if (opcode === 0x09) { // PING -> PONG
        if (this.readyState === 1 && this.socket.writable) {
          try { this.socket.write(createWsFrame(payload, 0x0a)) } catch (_) {}
        }
      } else if (opcode === 0x01) { // TEXT
        this.emit('message', payload.toString('utf8'), false)
      } else if (opcode === 0x02) { // BINARY
        this.emit('message', payload, true)
      }
    }
  }
}

export function handleWsUpgrade(req, socket, head, callback) {
  const key = req.headers['sec-websocket-key']
  if (!key) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
    socket.destroy()
    return null
  }
  const accept = computeAcceptKey(key)
  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '\r\n',
  ].join('\r\n')

  socket.write(responseHeaders)
  const ws = new WsConnection(socket)
  if (head && head.length > 0) {
    ws._onData(head)
  }
  if (typeof callback === 'function') {
    callback(ws)
  }
  return ws
}
