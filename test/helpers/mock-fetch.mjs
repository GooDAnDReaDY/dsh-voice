// Controllable global fetch double for provider/polish tests.
export function installMockFetch(impl) {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init })
    return impl(String(url), init)
  }
  return {
    calls,
    restore() { globalThis.fetch = original },
  }
}

export function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}