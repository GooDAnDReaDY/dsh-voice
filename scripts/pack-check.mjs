#!/usr/bin/env node
import { execSync } from 'node:child_process'

const WARN_LIMIT = 250 * 1024
const BLOCK_LIMIT = 262144

try {
  const jsonStr = execSync('npm pack --dry-run --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const parsed = JSON.parse(jsonStr)
  const pkg = Array.isArray(parsed) ? parsed[0] : parsed
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
