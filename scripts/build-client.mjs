#!/usr/bin/env node
// Concatenate lib/client-src fragments into lib/client.js (single ModuleLoader entry).
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const srcDir = path.join(root, 'lib', 'client-src')
const outFile = path.join(root, 'lib', 'client.js')

const files = (await readdir(srcDir)).filter((f) => f.endsWith('.js')).sort()
if (files.length === 0) throw new Error('no client-src fragments')
let out = ''
for (const f of files) {
  out += await readFile(path.join(srcDir, f), 'utf8')
  if (!out.endsWith('\n')) out += '\n'
}
await writeFile(outFile, out, 'utf8')
console.log(`built lib/client.js from ${files.length} fragments (${out.length} bytes)`)
