#!/usr/bin/env node
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const WARN_LIMIT = 250 * 1024
const BLOCK_LIMIT = 262144

// Ensure release tarballs are not left in source root (#154)
const rootFiles = fs.readdirSync(process.cwd())
const strayTarballs = rootFiles.filter((f) => f.endsWith('.tgz'))
if (strayTarballs.length > 0) {
  console.error(`[pack:check] ERROR: Untracked release tarballs found in source root: ${strayTarballs.join(', ')}. Artifacts must be created outside checkout.`)
  process.exit(1)
}

try {
  const jsonStr = execSync('npm pack --dry-run --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const parsed = JSON.parse(jsonStr)
  let pkg = parsed
  if (Array.isArray(parsed)) {
    pkg = parsed[0]
  } else if (parsed && typeof parsed === 'object') {
    const values = Object.values(parsed)
    if (values.length > 0 && values[0]?.files) {
      pkg = values[0]
    }
  }
  const files = pkg.files || []
  let oversized = false

  for (const f of files) {
    if (f.size > BLOCK_LIMIT) {
      console.error(`[pack:check] ERROR: File "${f.path}" (${f.size} bytes) exceeds block limit ${BLOCK_LIMIT} bytes`)
      oversized = true
    } else if (f.size > WARN_LIMIT) {
      console.warn(`[pack:check] WARN: File "${f.path}" (${f.size} bytes) exceeds warn limit ${WARN_LIMIT} bytes`)
    }
  }

  if (oversized) {
    process.exit(1)
  }

  console.log(`[pack:check] OK: ${files.length} files packed (${pkg.size} bytes uncompressed / ${pkg.unpackedSize} bytes unpacked). All files under ${BLOCK_LIMIT} bytes.`)
} catch (err) {
  console.error('[pack:check] Failed to check pack size:', err.message || err)
  process.exit(1)
}
