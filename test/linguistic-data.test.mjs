import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const ALLOWED_CYRILLIC_FILES = new Set([
  'lib/normalize.js',
  'lib/transcribe-core.js',
  'lib/polish.js',
  'lib/client-src/30-core.js',
  'lib/client-src/40-recording.js',
  'lib/client.js',
])

function findSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  let files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.worktrees') {
      files = files.concat(findSourceFiles(full))
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      files.push(full)
    }
  }
  return files
}

test('all comments in lib/ and lib/client-src/ contain zero Cyrillic characters (#122)', () => {
  const libFiles = findSourceFiles(path.join(rootDir, 'lib'))
  const cyrillicRegex = /[\u0400-\u04FF]/

  for (const file of libFiles) {
    const content = fs.readFileSync(file, 'utf8')
    const relPath = path.relative(rootDir, file).replace(/\\/g, '/')
    if (relPath === 'lib/client.js') continue

    // Check block comments
    const blockComments = content.match(/\/\*[\s\S]*?\*\//g) || []
    for (const comment of blockComments) {
      assert.ok(
        !cyrillicRegex.test(comment),
        `Cyrillic character found in block comment in ${relPath}: ${comment.slice(0, 40)}`
      )
    }

    // Check single-line comments
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const singleCommentIdx = line.indexOf('//')
      if (singleCommentIdx >= 0) {
        const comment = line.slice(singleCommentIdx)
        assert.ok(
          !cyrillicRegex.test(comment),
          `Cyrillic character found in single line comment in ${relPath}:${i + 1}: ${comment.slice(0, 40)}`
        )
      }
    }
  }
})

test('Cyrillic characters in lib/ are strictly confined to allowed linguistic processing data (#122)', () => {
  const libFiles = findSourceFiles(path.join(rootDir, 'lib'))
  const cyrillicRegex = /[\u0400-\u04FF]/

  for (const file of libFiles) {
    const relPath = path.relative(rootDir, file).replace(/\\/g, '/')
    const content = fs.readFileSync(file, 'utf8')
    if (cyrillicRegex.test(content)) {
      assert.ok(
        ALLOWED_CYRILLIC_FILES.has(relPath),
        `Unexpected Cyrillic character found in non-linguistic module: ${relPath}`
      )
    }
  }
})

test('client locale dictionaries contain only en and zh translations without Cyrillic (#122)', () => {
  const localeFile = path.join(rootDir, 'lib/client-src/10-locale.js')
  const content = fs.readFileSync(localeFile, 'utf8')
  const cyrillicRegex = /[\u0400-\u04FF]/
  assert.ok(!cyrillicRegex.test(content), '10-locale.js must not contain hardcoded Cyrillic UI translations')
})
