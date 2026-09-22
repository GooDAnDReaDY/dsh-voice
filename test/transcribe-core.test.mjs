import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildProviderOrder } from '../lib/transcribe-core.js'

const knownKeys = ['browser', 'deepgram', 'groq', 'hf', 'local-whisper', 'sensevoice']
const base = {
  customKeys: [],
  knownKeys,
  defaultModels: { 'local-whisper': 'base', sensevoice: 'SenseVoiceSmall' },
}

test('localOnly keeps sensevoice when local-whisper is absent', () => {
  const { order } = buildProviderOrder({
    ...base,
    localOnly: true,
    chain: [{ provider: 'sensevoice', model: '' }, { provider: 'groq', model: '' }],
  })
  assert.deepEqual(order, ['sensevoice'])
})

test('localOnly still rejects a cloud-only chain', () => {
  assert.throws(
    () => buildProviderOrder({
      ...base,
      localOnly: true,
      chain: [{ provider: 'groq', model: '' }],
    }),
    /no local engine/,
  )
})
