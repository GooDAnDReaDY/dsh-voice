// Minimal request/response doubles for host-route helpers.
// No cordis, no network, no peer dependencies.

export function mockReq(method, body) {
  const chunks = []
  if (body != null) {
    chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body)))
  }
  let dataCb = null
  let endCb = null
  let errCb = null
  const req = {
    method,
    headers: {},
    destroyed: false,
    on(event, cb) {
      if (event === 'data') dataCb = cb
      if (event === 'end') endCb = cb
      if (event === 'error') errCb = cb
      return req
    },
    destroy() {
      req.destroyed = true
      if (errCb) errCb(new Error('aborted'))
    },
    fire() {
      queueMicrotask(() => {
        if (req.destroyed) return
        for (const c of chunks) dataCb && dataCb(c)
        endCb && endCb()
      })
    },
  }
  return req
}

/** One oversized chunk so readBody rejects once listeners are attached. */
export function mockOversizedReq(method, bytes) {
  return mockReq(method, Buffer.alloc(bytes))
}

export function mockRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: null,
    finished: false,
    writeHead(code, headers) {
      res.statusCode = code
      Object.assign(res.headers, headers || {})
    },
    end(data) {
      res.body = data == null ? null : String(data)
      res.finished = true
      if (res._resolve) res._resolve(res)
    },
  }
  res.done = new Promise((resolve) => { res._resolve = resolve })
  return res
}

export function jsonBody(res) {
  if (res.body == null) return null
  try { return JSON.parse(res.body) } catch { return null }
}

export function base64Audio(n = 8) {
  return Buffer.alloc(n, 1).toString('base64')
}