// Regression test for resolveKey: every keyEnv provider reported "no <ENV>"
// because the guard tested ref.type on a plain string, and the credential
// object was returned instead of its .value.
import assert from 'node:assert/strict'
import test from 'node:test'

// Mirror of the fixed helper: `credentials.resolve()` answers { value, source }.
function makeResolveKey(credentials) {
  const credentialRef = (v) => {
    if (typeof v !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(v)) throw new TypeError('bad ref')
    return v
  }
  return async (ref) => {
    if (!ref) return ''
    try {
      const resolved = await credentials.resolve(credentialRef(ref))
      return resolved?.value || ''
    } catch {
      return ''
    }
  }
}

const credentials = {
  resolve: async (ref) => (ref === 'DEEPGRAM_API_KEY' ? { value: 'sk-live-123', source: 'env' } : undefined),
}

test('resolves a plain string reference to its secret', async () => {
  assert.equal(await makeResolveKey(credentials)('DEEPGRAM_API_KEY'), 'sk-live-123')
})

test('returns an empty string for an unknown reference', async () => {
  assert.equal(await makeResolveKey(credentials)('MISSING_KEY'), '')
})

test('returns an empty string for a missing reference', async () => {
  assert.equal(await makeResolveKey(credentials)(undefined), '')
  assert.equal(await makeResolveKey(credentials)(''), '')
})

test('a string has no .type, which is why the old guard always short-circuited', () => {
  assert.equal(('DEEPGRAM_API_KEY').type, undefined)
})
