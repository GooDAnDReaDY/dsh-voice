import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTrustedUpdateRequest, registerPluginUpdater } from '../lib/updater.js'

test('isTrustedUpdateRequest rejects remote, cross-site, or untrusted requests', () => {
  // Missing update header
  assert.equal(
    isTrustedUpdateRequest({
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    }),
    false,
    'request without x-dsh-plugin-update: 1 must be rejected'
  )

  // Remote address
  assert.equal(
    isTrustedUpdateRequest({
      headers: { 'x-dsh-plugin-update': '1', origin: 'http://192.168.1.50:3000', host: '192.168.1.50:3000' },
      socket: { remoteAddress: '192.168.1.50' },
    }),
    false,
    'remote IP must be rejected'
  )

  // Cross-site
  assert.equal(
    isTrustedUpdateRequest({
      headers: {
        'x-dsh-plugin-update': '1',
        'sec-fetch-site': 'cross-site',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      socket: { remoteAddress: '127.0.0.1' },
    }),
    false,
    'cross-site request must be rejected'
  )

  // Mismatched origin and host
  assert.equal(
    isTrustedUpdateRequest({
      headers: {
        'x-dsh-plugin-update': '1',
        origin: 'http://localhost:4000',
        host: 'localhost:3000',
      },
      socket: { remoteAddress: '127.0.0.1' },
    }),
    false,
    'mismatched origin and host must be rejected'
  )

  // Valid local same-origin request
  assert.equal(
    isTrustedUpdateRequest({
      headers: {
        'x-dsh-plugin-update': '1',
        'sec-fetch-site': 'same-origin',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      socket: { remoteAddress: '127.0.0.1' },
    }),
    true,
    'trusted same-origin loopback request must be accepted'
  )
})

test('registerPluginUpdater mounts update route with method checking', async () => {
  let registered = null
  const fakeCtx = {
    webServer: {
      register: (route) => {
        registered = route
        return () => {}
      },
    },
  }

  registerPluginUpdater(fakeCtx, {
    endpoint: '/api/dsh-voice/update',
    packageName: '@goodandready/dsh-voice',
  })

  assert.ok(registered)
  assert.equal(registered.path, '/api/dsh-voice/update')
  assert.equal(registered.kind, 'exact')

  // DELETE request returns 405 Method Not Allowed
  let status = 0
  await registered.handler({ method: 'DELETE' }, {
    writeHead: (s) => { status = s },
    end: () => {},
  })
  assert.equal(status, 405)

  // Untrusted POST returns 403 Forbidden
  let postStatus = 0
  await registered.handler({
    method: 'POST',
    headers: {},
    socket: { remoteAddress: '192.168.1.99' },
  }, {
    writeHead: (s) => { postStatus = s },
    end: () => {},
  })
  assert.equal(postStatus, 403)
})
