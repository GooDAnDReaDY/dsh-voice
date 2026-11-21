// test/docs-sync.test.mjs — Verify documentation completeness against codebase (#351)
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Issue #351: index.md documents every module in lib/*.js', () => {
  const indexContent = fs.readFileSync('index.md', 'utf8')
  const libFiles = fs.readdirSync('lib').filter((f) => f.endsWith('.js') && !f.endsWith('.debug.js'))

  for (const f of libFiles) {
    assert.ok(
      indexContent.includes(`lib/${f}`),
      `index.md must document lib/${f}`
    )
  }
})

test('Issue #351: README files document 5 dictation modes and WebSocket upgrade route', () => {
  const enReadme = fs.readFileSync('README.md', 'utf8')
  const ruReadme = fs.readFileSync('README.ru.md', 'utf8')
  const zhReadme = fs.readFileSync('README.zh.md', 'utf8')

  assert.ok(enReadme.includes('5 Dictation Post-Processing Modes'))
  assert.ok(ruReadme.includes('5 режимов диктовки'))
  assert.ok(zhReadme.includes('5 种听写后处理模式'))

  assert.ok(enReadme.includes('WebSocket /dsh-voice/ws/stream'))
})
