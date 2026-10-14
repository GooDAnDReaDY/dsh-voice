// Pure HTTP helpers shared by host routes. No cordis, no network.
import { randomBytes, timingSafeEqual } from 'node:crypto'

export class BodyTooLargeError extends Error {
  constructor(message = 'body too large') {
    super(message)
    this.name = 'BodyTooLargeError'
    this.statusCode = 413
    this.code = 'ERR_BODY_TOO_LARGE'
  }
}

let sessionSecret = ''
export function getVoiceSessionToken() {
  if (!sessionSecret) {
    sessionSecret = randomBytes(24).toString('hex')
  }
  return sessionSecret
}

export function setVoiceSessionToken(t) {
  sessionSecret = String(t || '')
}

export function verifyVoiceSessionToken(token) {
  if (!token || typeof token !== 'string') return false
  const secret = getVoiceSessionToken()
  if (token.length !== secret.length) return false
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  } catch {
    return false
  }
}

export function writeJson(res, code, body) {
  try {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    if (code === 413) {
      headers['Connection'] = 'close'
    }
    res.writeHead(code, headers)
    res.end(JSON.stringify(body))
    if (code === 413 && res && typeof res.on === 'function') {
      res.on('finish', () => {
        const sock = res.socket || (res.req && res.req.socket)
        if (sock && !sock.destroyed && typeof sock.destroy === 'function') {
          sock.destroy()
        }
      })
    }
  } catch { /* socket may already be closed */ }
}

/**
 * Collect request body with a hard size cap.
 * @param {import('node:stream').Readable} req
 * @param {number} maxBytes
 * @returns {Promise<Buffer>}
 */
export function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let exceeded = false
    const onData = (c) => {
      if (exceeded) return
      size += c.length
      if (size > maxBytes) {
        exceeded = true
        if (typeof req.removeListener === 'function') {
          req.removeListener('data', onData)
        }
        if (typeof req.resume === 'function') {
          req.resume()
        }
        reject(new BodyTooLargeError('body too large'))
        return
      }
      chunks.push(c)
    }
    req.on('data', onData)
    req.on('end', () => {
      if (!exceeded) resolve(Buffer.concat(chunks))
    })
    req.on('error', (err) => {
      if (!exceeded) reject(err)
    })
  })
}

/**
 * Check whether an IP address is a local loopback interface.
 * @param {string} addr
 * @returns {boolean}
 */
export function isLoopback(addr) {
  if (!addr) return false
  const clean = String(addr).replace(/^::ffff:/, '')
  return clean === '127.0.0.1' || clean === '::1' || clean === 'localhost'
}

/**
 * Verify that the HTTP request originates from a trusted caller.
 * Fail-closed security guard for state-changing or quota-consuming POST routes (#117, #173, #277).
 * - Loopback callers (127.0.0.1, ::1) are trusted unless rejected by browser security headers.
 * - Non-loopback LAN mutating/quota-consuming POST/PUT requests require valid session token (#277).
 * - Routes marked loopbackOnly strictly reject non-loopback callers.
 * @param {import('node:http').IncomingMessage} req
 * @param {{ loopbackOnly?: boolean }} [options]
 * @returns {boolean}
 */
export function isTrustedCaller(req, options = {}) {
  if (!req) return false

  // 1. Browser security headers: immediately reject cross-site and same-site requests (#117, #173)
  const secSite = String(req.headers?.['sec-fetch-site'] || '').toLowerCase()
  if (secSite === 'cross-site' || secSite === 'same-site') return false

  // 2. If Origin header is present, it must strictly match the Host header
  const host = String(req.headers?.host || '').toLowerCase()
  const origin = String(req.headers?.origin || '').trim().toLowerCase()
  if (origin) {
    try {
      const u = new URL(origin)
      if (u.host !== host) return false
    } catch {
      return false
    }
  }

  // 3. If Referer header is present, it must strictly match the Host header
  const referer = String(req.headers?.referer || '').trim().toLowerCase()
  if (referer) {
    try {
      const u = new URL(referer)
      if (u.host !== host) return false
    } catch {
      return false
    }
  }

  // 4. For state-changing or data-carrying requests (POST/PUT/PATCH), require application/json or octet-stream
  const method = String(req.method || 'GET').toUpperCase()
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const contentType = String(req.headers?.['content-type'] || '').toLowerCase()
    const isJson = contentType.startsWith('application/json')
    const isOctet = contentType.startsWith('application/octet-stream')
    if (!isJson && !isOctet) {
      return false
    }
  }

  // 5. Loopback remote address is trusted when not rejected by browser headers above
  const remote = req.socket?.remoteAddress || req.connection?.remoteAddress || ''
  if (isLoopback(remote)) return true

  // If route strictly requires loopback (e.g. host model installer or hardware benchmark)
  if (options && options.loopbackOnly) return false

  // 6. Non-loopback LAN requests: POST/PUT/PATCH quota-burning operations require session auth token (#277)
  const isMutating = method === 'POST' || method === 'PUT' || method === 'PATCH'
  if (isMutating) {
    const incomingToken = String(req.headers?.['x-dsh-voice-token'] || req.headers?.['x-voice-token'] || '')
    if (incomingToken && verifyVoiceSessionToken(incomingToken)) {
      return true
    }
    return false
  }

  // 7. Non-state-changing GET requests from LAN: verify same-origin
  if (secSite === 'same-origin') return true
  if (origin) {
    try {
      const u = new URL(origin)
      if (u.host === host) return true
    } catch { /* invalid url */ }
    return false
  }
  if (referer) {
    try {
      const u = new URL(referer)
      if (u.host === host) return true
    } catch { /* invalid url */ }
    return false
  }

  return false
}
