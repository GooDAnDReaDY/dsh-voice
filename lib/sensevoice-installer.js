// lib/sensevoice-installer.js — 1-Click installer for SenseVoice-Small / sherpa-onnx
// Downloads pre-quantized ONNX model and configures autostart on the host.

import { createWriteStream, existsSync, readdirSync } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { writeJson, isTrustedCaller } from './http-util.js'

export const SENSEVOICE_MODEL_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2'
export const SENSEVOICE_MODEL_MIRROR =
  'https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2'

let installerState = {
  installing: false,
  progress: 0,
  step: 'idle',
  error: null,
  modelPath: '',
}

export function getDefaultModelDir() {
  return path.join(homedir(), '.dsh', 'models', 'sensevoice')
}

export function findModelFile(dir) {
  if (!dir || !existsSync(dir)) return null
  try {
    const entries = readdirSync(dir, { recursive: true, withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && (entry.name === 'model.int8.onnx' || entry.name === 'model.onnx')) {
        const parent = entry.parentPath || (entry.path ? entry.path : dir)
        return path.join(parent, entry.name)
      }
    }
  } catch { /* directory read failed */ }
  return null
}

export function findTokensFile(dir) {
  if (!dir || !existsSync(dir)) return null
  try {
    const entries = readdirSync(dir, { recursive: true, withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name === 'tokens.txt') {
        const parent = entry.parentPath || (entry.path ? entry.path : dir)
        return path.join(parent, entry.name)
      }
    }
  } catch { /* directory read failed */ }
  return null
}

export async function getSensevoiceStatus(cfg, isAliveFn) {
  const modelDir = cfg?.sensevoiceModel ? path.dirname(cfg.sensevoiceModel) : getDefaultModelDir()
  const modelFile = cfg?.sensevoiceModel && existsSync(cfg.sensevoiceModel)
    ? cfg.sensevoiceModel
    : findModelFile(getDefaultModelDir())
  const tokensFile = modelFile ? findTokensFile(path.dirname(modelFile)) : null

  const running = typeof isAliveFn === 'function' ? await isAliveFn() : false
  const installed = Boolean(modelFile && existsSync(modelFile))

  return {
    installed,
    running,
    modelPath: modelFile || '',
    tokensPath: tokensFile || '',
    installing: installerState.installing,
    progress: installerState.progress,
    step: installerState.step,
    error: installerState.error,
  }
}

export async function downloadArchive(url, destPath, onProgress) {
  const res = await fetch(url, { signal: AbortSignal.timeout(600_000) })
  if (!res.ok) throw new Error(`Download failed with HTTP ${res.status}`)

  const totalBytes = Number(res.headers.get('content-length')) || 150_000_000
  let receivedBytes = 0

  const fileStream = createWriteStream(destPath)
  const reader = res.body.getReader()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    fileStream.write(value)
    receivedBytes += value.length
    if (typeof onProgress === 'function') {
      const pct = Math.min(95, Math.round((receivedBytes / totalBytes) * 90))
      onProgress(pct, `downloading (${Math.round(receivedBytes / 1024 / 1024)} MB)`)
    }
  }

  await new Promise((resolve, reject) => {
    fileStream.end()
    fileStream.on('finish', resolve)
    fileStream.on('error', reject)
  })
}

export function extractTarBz2(archivePath, targetDir) {
  return new Promise((resolve, reject) => {
    const child = spawn('tar', ['-xjf', archivePath, '-C', targetDir])
    let stderr = ''
    child.stderr.on('data', (d) => { stderr += d })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`tar extraction failed with code ${code}: ${stderr}`))
    })
    child.on('error', reject)
  })
}

export async function startSensevoiceInstall(ctx, cfg, updateConfigFn, startSensevoiceFn) {
  if (installerState.installing) {
    throw new Error('SenseVoice installation is already in progress')
  }

  installerState = {
    installing: true,
    progress: 5,
    step: 'preparing',
    error: null,
    modelPath: '',
  }

  const modelDir = getDefaultModelDir()
  const archivePath = path.join(modelDir, 'sensevoice.tar.bz2')

  try {
    await mkdir(modelDir, { recursive: true })
    installerState.step = 'downloading'
    installerState.progress = 10

    let downloadOk = false
    try {
      await downloadArchive(SENSEVOICE_MODEL_URL, archivePath, (pct, status) => {
        installerState.progress = pct
        installerState.step = status
      })
      downloadOk = true
    } catch (e1) {
      // Fallback to mirror
      installerState.step = 'downloading (mirror)'
      await downloadArchive(SENSEVOICE_MODEL_MIRROR, archivePath, (pct, status) => {
        installerState.progress = pct
        installerState.step = status
      })
      downloadOk = true
    }

    if (!downloadOk) throw new Error('Could not download SenseVoice model from primary or mirror URL')

    installerState.step = 'extracting'
    installerState.progress = 95
    await extractTarBz2(archivePath, modelDir)

    const modelFile = findModelFile(modelDir)
    if (!modelFile) throw new Error('model.int8.onnx not found after extraction')

    installerState.modelPath = modelFile
    installerState.progress = 100
    installerState.step = 'ready'
    installerState.installing = false

    if (typeof updateConfigFn === 'function') {
      await updateConfigFn({
        sensevoiceModel: modelFile,
        sensevoiceAutostart: true,
      })
    }

    if (typeof startSensevoiceFn === 'function') {
      await startSensevoiceFn()
    }

    return { ok: true, modelPath: modelFile }
  } catch (err) {
    installerState.installing = false
    installerState.error = String(err?.message || err)
    installerState.step = 'failed'
    throw err
  }
}

export function registerSensevoiceInstaller(ctx, { liveConfig, isAlive, updateConfig, startSensevoice }) {
  if (!ctx.webServer || typeof ctx.webServer.register !== 'function') return

  ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-voice/sensevoice-installer',
    handler: async (req, res) => {
      if (req.method === 'GET') {
        const status = await getSensevoiceStatus(liveConfig(), isAlive)
        writeJson(res, 200, status)
        return
      }

      if (req.method === 'POST') {
        if (!isTrustedCaller(req)) {
          writeJson(res, 403, { ok: false, error: 'Forbidden: untrusted caller' })
          return
        }

        if (installerState.installing) {
          writeJson(res, 409, { ok: false, error: 'Installation already in progress', state: installerState })
          return
        }

        // Start background install
        startSensevoiceInstall(ctx, liveConfig(), updateConfig, startSensevoice).catch((err) => {
          ctx.logger?.warn?.(`SenseVoice 1-click install error: ${String(err)}`)
        })

        writeJson(res, 202, { ok: true, message: 'SenseVoice installation started', state: installerState })
        return
      }

      writeJson(res, 405, { ok: false, error: 'Method not allowed' })
    },
  })
}
