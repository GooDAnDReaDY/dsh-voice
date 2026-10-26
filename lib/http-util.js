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

export function rotateVoiceSessionToken() {
  sessionSecret = randomBytes(24).toString('hex')
  return sessionSecret
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
  return clean === '127.0.0.1' || clean === '::1' || clean === 'localhost' || clean === '[::1]'
}

/**
 * Check whether an incoming HTTP request is from the DeepSeek desktop shell (#12, #295).
 * Matches patterns from @deepseek-ai/dsh-desktop and official DSH shell wrappers.
 * @param {import('node:http').IncomingMessage} req
 * @returns {boolean}
 */
export function isDesktopShellRequest(req) {
  if (!req || !req.headers) return false
  const ua = String(req.headers['user-agent'] || '')
  const cookie = String(req.headers.cookie || '')
  if (ua.includes('@deepseek-ai/dsh-desktop/') && cookie.includes('dsh-auth-')) return true
  const remote = req.socket?.remoteAddress || req.connection?.remoteAddress || ''
  if (ua.includes('dsh-desktop') && isLoopback(remote)) return true
  return false
}

/**
 * Check whether an incoming HTTP request carries a DeepSeek Harness session cookie (#295).
 * DSH core sets 'dsh-auth-<hash>=v1...' as a SameSite=Strict HttpOnly cookie.
 * @param {import('node:http').IncomingMessage} req
 * @returns {boolean}
 */
export function hasDshAuthCookie(req) {
  if (!req || !req.headers) return false
  const cookie = String(req.headers.cookie || '')
  return cookie.includes('dsh-auth-')
}

/**
 * Split host header or URL host into lowercase hostname and port string.
 * @param {string} rawHost
 * @returns {{ hostname: string, port: string }}
 */
function parseHost(rawHost) {
  if (!rawHost) return { hostname: '', port: '' }
  const clean = String(rawHost).trim().toLowerCase()
  const ipv6Match = clean.match(/^\[([^\]]+)\](?::(\d+))?$/)
  let hostname = ''
  let port = ''
  if (ipv6Match) {
    hostname = ipv6Match[1]
    port = ipv6Match[2] || ''
  } else {
    const parts = clean.split(':')
    hostname = parts[0]
    port = parts[1] || ''
  }
  if (port === '80' || port === '443') {
    port = ''
  }
  return { hostname, port }
}

/**
 * Verify whether an Origin or Referer URL is allowed for the given Host header (#12, #292, #295).
 * @param {string} urlStr
 * @param {string} hostHeader
 * @param {import('node:http').IncomingMessage} req
 * @returns {boolean}
 */
export function isOriginOrRefererAllowed(urlStr, hostHeader, req) {
  if (!urlStr || typeof urlStr !== 'string') return false
  const trimmed = urlStr.trim()
  if (!trimmed) return false

  const remote = req?.socket?.remoteAddress || req?.connection?.remoteAddress || ''
  const remoteIsLoopback = isLoopback(remote)

  // 1. Literal 'null' origin (sent by Chromium/Electron for local files or sandboxed views)
  if (trimmed === 'null') {
    return remoteIsLoopback && (isDesktopShellRequest(req) || hasDshAuthCookie(req))
  }

  try {
    const u = new URL(trimmed)

    // 2. Official DeepSeek desktop custom app scheme (e.g. dsh-app://app or dsh-app://localhost)
    if (u.protocol === 'dsh-app:') {
      const appHost = u.host.toLowerCase()
      const allowedAppHost = !appHost || appHost === 'app' || appHost === 'localhost'
      return allowedAppHost && remoteIsLoopback
    }

    // 3. Web schemes: HTTP and HTTPS
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      if (!hostHeader) return false
      const target = parseHost(hostHeader)
      const origin = parseHost(u.host)

      // Exact match
      if (origin.hostname === target.hostname && origin.port === target.port) {
        return true
      }

      // Loopback equivalence (e.g. localhost:3080 vs 127.0.0.1:3080 or ::1:3080)
      if (isLoopback(origin.hostname) && isLoopback(target.hostname) && origin.port === target.port) {
        return true
      }
    }

    return false
  } catch {
    return false
  }
}

/**
 * Check whether a request originates from the same origin as the Host header or trusted desktop shell (#12, #292, #295).
 * @param {import('node:http').IncomingMessage} req
 * @returns {boolean}
 */
export function hasSameOrigin(req) {
  if (!req || !req.headers) return false
  const secSite = String(req.headers['sec-fetch-site'] || '').toLowerCase()
  if (secSite === 'cross-site' || secSite === 'same-site') return false

  const host = String(req.headers.host || '').trim().toLowerCase()
  if (!host) return false

  const origin = String(req.headers.origin || '').trim()
  if (origin) {
    return isOriginOrRefererAllowed(origin, host, req)
  }

  const referer = String(req.headers.referer || '').trim()
  if (referer) {
    return isOriginOrRefererAllowed(referer, host, req)
  }

  // Same-origin metadata from browser Fetch API
  if (secSite === 'same-origin') return true

  // DeepSeek Desktop shell or authenticated DSH session on loopback/same-host
  const remote = req.socket?.remoteAddress || req.connection?.remoteAddress || ''
  if (isDesktopShellRequest(req)) return true
  if (hasDshAuthCookie(req) && (isLoopback(remote) || host)) return true

  return false
}

/**
 * Verify that the HTTP request originates from a trusted caller.
 * Fail-closed security guard for state-changing or quota-consuming routes (#117, #173, #277, #292, #295).
 * - Routes marked loopbackOnly strictly reject non-loopback callers.
 * - Mutating requests (POST, PUT, PATCH) or WS upgrades require validated same-origin or valid session token (#12, #292, #295).
 *   Raw LAN callers or reverse bridges without Origin/Referer/Cookie and without token are fail-closed rejected.
 * - Non-mutating GET requests require loopback or same-origin.
 * @param {import('node:http').IncomingMessage} req
 * @param {{ loopbackOnly?: boolean }} [options]
 * @returns {boolean}
 */
export function isTrustedCaller(req, options = {}) {
  if (!req) return false

  // 1. Browser security headers: immediately reject cross-site and same-site requests (#117, #173)
  const secSite = String(req.headers?.['sec-fetch-site'] || '').toLowerCase()
  if (secSite === 'cross-site' || secSite === 'same-site') return false

  const host = String(req.headers?.host || '').toLowerCase()

  // 2. If Origin header is present, verify against host or trusted desktop scheme (#12, #292, #295)
  const origin = String(req.headers?.origin || '').trim()
  if (origin) {
    if (!isOriginOrRefererAllowed(origin, host, req)) return false
  }

  // 3. If Referer header is present, verify against host or trusted desktop scheme (#12, #292, #295)
  const referer = String(req.headers?.referer || '').trim()
  if (referer) {
    if (!isOriginOrRefererAllowed(referer, host, req)) return false
  }

  // 4. For state-changing or data-carrying requests (POST/PUT/PATCH), require application/json or octet-stream
  const method = String(req.method || 'GET').toUpperCase()
  const isMutating = method === 'POST' || method === 'PUT' || method === 'PATCH'
  if (isMutating) {
    const contentType = String(req.headers?.['content-type'] || '').toLowerCase()
    const isJson = contentType.startsWith('application/json')
    const isOctet = contentType.startsWith('application/octet-stream')
    if (!isJson && !isOctet) {
      return false
    }
  }

  const remote = req.socket?.remoteAddress || req.connection?.remoteAddress || ''
  const remoteIsLoopback = isLoopback(remote)
  const hostName = host.replace(/:\d+$/, '')
  const hostIsLoopback = isLoopback(hostName)
  const isPureLocal = remoteIsLoopback && hostIsLoopback

  // 5. If route strictly requires loopback (e.g. host model installer or hardware benchmark)
  if (options && options.loopbackOnly) {
    if (!isPureLocal) return false
    return true
  }

  // 6. Mutating requests (POST/PUT/PATCH):
  // Even from loopback (which may be proxied via dsh-lanmode bridge), requests without Origin/Referer
  // must present a valid x-dsh-voice-token (#292).
  // Non-loopback LAN callers strictly require a valid session token to prevent forged LAN mutations (#277).
  if (isMutating) {
    const incomingToken = String(req.headers?.['x-dsh-voice-token'] || req.headers?.['x-voice-token'] || '')
    const hasValidToken = Boolean(incomingToken && verifyVoiceSessionToken(incomingToken))

    if (!remoteIsLoopback) {
      // Non-loopback LAN callers: always require valid token (#277)
      return hasValidToken
    }

    // Loopback callers (local browser, desktop shell, or reverse bridge dsh-lanmode):
    // If request has verified same-origin or desktop shell, allow it (#12, #295).
    if (hasSameOrigin(req)) return true
    // If request has valid session token, allow it.
    if (hasValidToken) return true
    // Requests without Origin/Referer and without token: strictly reject (#292)
    return false
  }

  // 7. Loopback remote address for non-mutating GET requests
  if (remoteIsLoopback) return true

  // 8. Non-loopback LAN GET requests: require same-origin or authenticated session
  if (secSite === 'same-origin') return true
  if (hasSameOrigin(req)) return true

  return false
}
