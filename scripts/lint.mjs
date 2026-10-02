#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const filesToCheck = []

// 1. All root files in lib/
for (const name of fs.readdirSync('lib')) {
  if (name.endsWith('.js')) {
    filesToCheck.push(path.join('lib', name))
  }
}

// 2. All scripts/
for (const name of fs.readdirSync('scripts')) {
  if (name.endsWith('.js') || name.endsWith('.mjs')) {
    filesToCheck.push(path.join('scripts', name))
  }
}

// 3. All test/ recursively
function collectTests(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectTests(full)
    } else if (entry.name.endsWith('.mjs') || entry.name.endsWith('.js')) {
      filesToCheck.push(full)
    }
  }
}
if (fs.existsSync('test')) {
  collectTests('test')
}

let errorCount = 0
for (const file of filesToCheck) {
  const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (res.status !== 0) {
    console.error(`[lint] Syntax error in ${file}:\n${res.stderr || res.stdout}`)
    errorCount++
  }
}

if (errorCount > 0) {
  console.error(`[lint] FAILED: ${errorCount} file(s) have syntax errors out of ${filesToCheck.length} checked.`)
  process.exit(1)
}

console.log(`[lint] OK: checked ${filesToCheck.length} files across lib/, scripts/, test/ — all syntax clean.`)
