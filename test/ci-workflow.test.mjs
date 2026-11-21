// test/ci-workflow.test.mjs — Verify CI workflow configuration (#349)
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Issue #349: .gitea/workflows/test.yml exists and defines test, build:check and pack-check steps', () => {
  const filePath = path.resolve('.gitea/workflows/test.yml')
  assert.ok(fs.existsSync(filePath), '.gitea/workflows/test.yml must exist')
  const content = fs.readFileSync(filePath, 'utf8')

  assert.ok(content.includes('name: test'), 'must name workflow')
  assert.ok(content.includes('npm ci'), 'must run npm ci')
  assert.ok(content.includes('npm run build:check'), 'must verify client bundle sync')
  assert.ok(content.includes('npm test'), 'must execute test suite')
  assert.ok(content.includes('npm pack --dry-run --json'), 'must guard package size and files')
})
