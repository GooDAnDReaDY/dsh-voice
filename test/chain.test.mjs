import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runChain } from '../lib/chain.js'

const ok = (name, text) => async () => ({ ok: true, provider: name, text })
const fail = (name, reason) => async () => ({ ok: false, provider: name, reason })
const boom = (msg) => async () => { throw new Error(msg) }

test('берёт первого успешного и не трогает остальных', async () => {
  let touched = false
  const out = await runChain(['a', 'b'], {
    a: ok('a', 'привет'),
    b: async () => { touched = true; return { ok: true, provider: 'b', text: 'нет' } },
  })
  assert.equal(out.text, 'привет')
  assert.equal(out.provider, 'a')
  assert.equal(touched, false)
})

test('переходит к следующему при отказе и при исключении', async () => {
  const out = await runChain(['a', 'b', 'c'], {
    a: fail('a', 'no key'),
    b: boom('HTTP 429'),
    c: ok('c', 'готово'),
  })
  assert.equal(out.provider, 'c')
})

test('пропускает провайдеров, которых нет в таблице', async () => {
  const out = await runChain(['нет-такого', 'a'], { a: ok('a', 'ок') })
  assert.equal(out.provider, 'a')
})

test('падает с перечислением причин, когда легли все', async () => {
  await assert.rejects(
    () => runChain(['a', 'b'], { a: fail('a', 'no key'), b: boom('HTTP 500') }),
    (err) => err.message.includes('no key') && err.message.includes('HTTP 500'),
  )
})

test('пустой транскрипт считается отказом', async () => {
  const out = await runChain(['a', 'b'], {
    a: async () => ({ ok: false, provider: 'a', reason: 'empty transcript' }),
    b: ok('b', 'текст'),
  })
  assert.equal(out.provider, 'b')
})
