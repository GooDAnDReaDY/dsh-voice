// Pure HTTP helpers shared by host routes. No cordis, no network.

export function writeJson(res, code, body) {
  try {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(body))
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
    req.on('data', (c) => {
      size += c.length
      if (size > maxBytes) { reject(new Error('body too large')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
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
 * Verify that the HTTP request originates from a trusted caller (loopback or same-origin).
 * Fail-closed security guard for state-changing or quota-consuming POST routes.
 * @param {import('node:http').IncomingMessage} req
 * @returns {boolean}
 */
export function isTrustedCaller(req) {
  if (!req) return false
  const remote = req.socket?.remoteAddress || req.connection?.remoteAddress || ''
  if (isLoopback(remote)) return true

  const secSite = String(req.headers?.['sec-fetch-site'] || '').toLowerCase()
  if (secSite === 'cross-site' || secSite === 'same-site') return false

  const host = String(req.headers?.host || '').toLowerCase()
  const origin = String(req.headers?.origin || '').trim().toLowerCase()
  if (origin) {
    try {
      const u = new URL(origin)
      if (u.host === host) return true
    } catch { /* invalid url */ }
    return false
  }

  if (secSite === 'same-origin') return true

  const referer = String(req.headers?.referer || '').trim().toLowerCase()
  if (referer) {
    try {
      const u = new URL(referer)
      if (u.host === host) return true
    } catch { /* invalid url */ }
    return false
  }

  return false
}