import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTranscriptionPrompt, DEFAULT_BILINGUAL_PROMPT } from '../lib/transcribe-core.js'
import { makeProviders } from '../lib/providers.js'
import { BaseConfig } from '../lib/schema.js'

test('buildTranscriptionPrompt generates default bilingual developer prompt for Russian language', () => {
  const res = buildTranscriptionPrompt({
    vocabulary: ['goodandready', 'MiniAI'],
    contextWords: ['dsh-voice', 'pnpm'],
    bilingualDeveloperPrompt: true,
    language: 'ru',
  })

  assert.ok(res.promptText.includes('TypeScript'), 'Contains TypeScript keyword from default prompt')
  assert.ok(res.promptText.includes('Docker'), 'Contains Docker keyword')
  assert.ok(res.promptText.includes('Смешанная речь разработчика'), 'Contains developer prompt context text')
  assert.ok(res.promptText.includes('Термины: goodandready, MiniAI, dsh-voice'), 'Contains merged vocabulary terms')
  assert.ok(res.keywords.includes('Docker'), 'Keywords include technical terms')
  assert.ok(res.keywords.includes('goodandready'), 'Keywords include custom vocabulary')
})

test('buildTranscriptionPrompt supports custom bilingual prompt', () => {
  const custom = 'Golang, Kubernetes, gRPC, microservices. Наш бэкенд стек.'
  const res = buildTranscriptionPrompt({
    vocabulary: ['my-service'],
    bilingualDeveloperPrompt: true,
    bilingualCustomPrompt: custom,
    language: 'ru',
  })

  assert.ok(res.promptText.startsWith(custom), 'Starts with custom prompt')
  assert.ok(res.promptText.includes('Термины: my-service'), 'Appends vocabulary terms')
})

test('buildTranscriptionPrompt disables developer primer when bilingualDeveloperPrompt is false', () => {
  const res = buildTranscriptionPrompt({
    vocabulary: ['customTerm'],
    bilingualDeveloperPrompt: false,
    language: 'ru',
  })

  assert.strictEqual(res.promptText, 'customTerm', 'Only contains pure vocabulary')
  assert.strictEqual(res.keywords, 'customTerm', 'Only contains pure vocabulary in keywords')
})

test('buildTranscriptionPrompt does not force Russian primer for pure English language', () => {
  const res = buildTranscriptionPrompt({
    vocabulary: ['react', 'vite'],
    bilingualDeveloperPrompt: true,
    language: 'en',
  })

  assert.strictEqual(res.promptText, 'react, vite', 'Does not inject Russian prompt into English transcription')
  assert.strictEqual(res.keywords, 'react, vite')
})

test('Config schema validates bilingualDeveloperPrompt and custom noiseGateDb values', () => {
  const parsedDefault = BaseConfig({})
  assert.strictEqual(parsedDefault.bilingualDeveloperPrompt, true)
  assert.strictEqual(parsedDefault.bilingualCustomPrompt, '')
  assert.strictEqual(parsedDefault.noiseGateDb, -45)

  const parsedCustom = BaseConfig({
    bilingualDeveloperPrompt: false,
    bilingualCustomPrompt: 'Rust, Cargo, WebAssembly',
    noiseGateDb: -42, // calibrated value
  })
  assert.strictEqual(parsedCustom.bilingualDeveloperPrompt, false)
  assert.strictEqual(parsedCustom.bilingualCustomPrompt, 'Rust, Cargo, WebAssembly')
  assert.strictEqual(parsedCustom.noiseGateDb, -42)
})

test('makeProviders forwards promptText to Groq and keywords to Deepgram', async () => {
  let capturedDeepgramUrl = ''
  let capturedGroqPrompt = ''

  const mockDeps = {
    resolveKey: async (env) => 'mock-key',
    fetchImpl: async (url, opts) => {
      if (typeof url === 'string' && url.includes('api.deepgram.com')) {
        capturedDeepgramUrl = url
        return { ok: true, json: async () => ({ results: { channels: [{ alternatives: [{ transcript: 'deepgram ok' }] }] } }) }
      }
      if (typeof url === 'string' && url.includes('api.groq.com')) {
        if (opts.body && typeof opts.body.get === 'function') {
          capturedGroqPrompt = opts.body.get('prompt')
        }
        return { ok: true, json: async () => ({ text: 'groq ok' }) }
      }
      return { ok: true, json: async () => ({}) }
    },
    cfg: {
      deepgramKeyEnv: 'DEEPGRAM_API_KEY',
      deepgramBaseUrl: 'https://api.deepgram.com',
      groqKeyEnv: 'GROQ_API_KEY',
    },
    toWav: async (b) => b,
  }

  const req = {
    bytes: Buffer.from('fake-audio'),
    mime: 'audio/webm',
    lang: 'ru',
    promptText: 'TypeScript, Docker. Термины: test-suite.',
    keywords: 'Docker, Git, test-suite',
  }

  const providers = makeProviders(mockDeps, req)
  
  await providers.deepgram()
  assert.ok(capturedDeepgramUrl.includes('&keywords='), 'Deepgram URL includes keywords')
  assert.ok(capturedDeepgramUrl.includes(encodeURIComponent('Docker, Git, test-suite')), 'Deepgram URL contains encoded keywords')

  await providers.groq()
  assert.strictEqual(capturedGroqPrompt, 'TypeScript, Docker. Термины: test-suite.', 'Groq receives full promptText in prompt field')
})
