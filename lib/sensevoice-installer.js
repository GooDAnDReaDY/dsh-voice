// lib/sensevoice-installer.js — 1-Click installer for SenseVoice-Small & Whisper Large-v3-Turbo
// Downloads pre-quantized ONNX models and configures autostart on the host via sherpa-onnx.

import { createWriteStream, createReadStream, existsSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { mkdir, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { writeJson, readBody, isTrustedCaller } from './http-util.js'

export const SENSEVOICE_MODEL_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2'
export const SENSEVOICE_MODEL_MIRROR =
  'https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2'

export const WHISPER_TURBO_MODEL_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-turbo.tar.bz2'
export const WHISPER_TURBO_MODEL_MIRROR =
  'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-turbo/resolve/main/sherpa-onnx-whisper-turbo.tar.bz2'

export const MODEL_SHA256 = {
  'sensevoice': 'f6b2a72ebcb1ac7a764d4cfccd886e6bcb2a95c4657c2199d0ba95ed4b9ea71a',
  'whisper-turbo': 'b11acbbcd660b44a8e0df33724feb5aaa709cf65668f2823d59f656312544f22',
}

export function verifyArchiveSha256(filePath, expectedSha256) {
  if (!expectedSha256) return Promise.resolve(true)
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => {
      const digest = hash.digest('hex').toLowerCase()
      if (digest === expectedSha256.toLowerCase()) {
        resolve(true)
      } else {
        reject(new Error(`SHA-256 verification failed: expected ${expectedSha256}, got ${digest}`))
      }
    })
    stream.on('error', reject)
  })
}

let installerState = {
  installing: false,
  progress: 0,
  step: 'idle',
  error: null,
  modelPath: '',
  modelType: 'sensevoice',
}

export function getDefaultModelDir(type = 'sensevoice') {
  const norm = String(type || '').toLowerCase()
  if (norm.includes('whisper') || norm.includes('turbo')) {
    return path.join(homedir(), '.dsh', 'models', 'whisper-turbo')
  }
  return path.join(homedir(), '.dsh', 'models', 'sensevoice')
}

export function findWhisperFiles(dir) {
  if (!dir || !existsSync(dir)) return null
  try {
    const entries = readdirSync(dir, { recursive: true, withFileTypes: true })
    let encoder = null
    let decoder = null
    let tokens = null
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const name = entry.name.toLowerCase()
      const parent = entry.parentPath || (entry.path ? entry.path : dir)
      const fullPath = path.join(parent, entry.name)

      if (name.includes('encoder') && name.endsWith('.onnx')) {
        if (!encoder || name.includes('int8')) encoder = fullPath
      } else if (name.includes('decoder') && name.endsWith('.onnx')) {
        if (!decoder || name.includes('int8')) decoder = fullPath
      } else if (name.endsWith('tokens.txt') || (name.includes('tokens') && name.endsWith('.txt'))) {
        tokens = fullPath
      }
    }
    if (encoder && decoder) {
      return { encoder, decoder, tokens }
    }
  } catch { /* directory read failed */ }
  return null
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
    const whisper = findWhisperFiles(dir)
    if (whisper) return whisper.encoder
  } catch { /* directory read failed */ }
  return null
}

export function redactModelPath(filePath) {
  if (!filePath) return ''
  const str = String(filePath).replace(/\\/g, '/')
  const idx = str.indexOf('.dsh/models/')
  if (idx !== -1) return '~/' + str.slice(idx)
  return path.basename(str)
}

export function findTokensFile(dir) {
  if (!dir || !existsSync(dir)) return null
  try {
    const entries = readdirSync(dir, { recursive: true, withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && (entry.name === 'tokens.txt' || entry.name === 'turbo-tokens.txt')) {
        const parent = entry.parentPath || (entry.path ? entry.path : dir)
        return path.join(parent, entry.name)
      }
    }
  } catch { /* directory read failed */ }
  return null
}

export async function getSensevoiceStatus(cfg, isAliveFn) {
  const customModel = cfg?.sensevoiceModel
  const customExists = Boolean(customModel && existsSync(customModel))
  const isWhisperCustom = customExists && (
    customModel.toLowerCase().includes('whisper') ||
    customModel.toLowerCase().includes('turbo') ||
    Boolean(findWhisperFiles(path.dirname(customModel)))
  )

  const svDir = getDefaultModelDir('sensevoice')
  const svFile = findModelFile(svDir)
  const turboDir = getDefaultModelDir('whisper-turbo')
  const turboFiles = findWhisperFiles(turboDir)

  let activeModelFile = null
  let activeTokensFile = null
  let activeModelType = 'sensevoice'

  if (customExists) {
    activeModelFile = customModel
    activeTokensFile = findTokensFile(path.dirname(customModel))
    activeModelType = isWhisperCustom ? 'whisper-turbo' : 'sensevoice'
  } else if (turboFiles) {
    activeModelFile = turboFiles.encoder
    activeTokensFile = turboFiles.tokens
    activeModelType = 'whisper-turbo'
  } else if (svFile) {
    activeModelFile = svFile
    activeTokensFile = findTokensFile(path.dirname(svFile))
    activeModelType = 'sensevoice'
  }

  const running = typeof isAliveFn === 'function' ? await isAliveFn() : false
  const installed = Boolean(activeModelFile && existsSync(activeModelFile))

  return {
    installed,
    running,
    modelType: activeModelType,
    modelPath: redactModelPath(activeModelFile),
    tokensPath: redactModelPath(activeTokensFile),
    path: installed ? `~/.dsh/models/${activeModelType}` : '',
    sensevoiceInstalled: Boolean(svFile),
    whisperTurboInstalled: Boolean(turboFiles),
    installing: installerState.installing,
    progress: installerState.progress,
    step: installerState.step,
    error: installerState.error,
  }
}

export async function downloadArchive(url, destPath, onProgress) {
  const res = await fetch(url, { signal: AbortSignal.timeout(600_000) })
  if (!res.ok) throw new Error(`Download failed with HTTP ${res.status}`)
  if (!res.body) throw new Error('Download failed with an empty body')

  const totalBytes = Number(res.headers.get('content-length')) || 150_000_000
  let receivedBytes = 0
  const progress = new Transform({
    transform(chunk, _enc, cb) {
      receivedBytes += chunk.length
      if (typeof onProgress === 'function') {
        const pct = Math.min(95, Math.round((receivedBytes / totalBytes) * 90))
        onProgress(pct, `downloading (${Math.round(receivedBytes / 1024 / 1024)} MB)`)
      }
      cb(null, chunk)
    },
  })
  await pipeline(Readable.fromWeb(res.body), progress, createWriteStream(destPath))
}

export function extractTarBz2(archivePath, targetDir) {
  return new Promise((resolve, reject) => {
    const child = spawn('tar', ['--no-same-owner', '-xjf', archivePath, '-C', targetDir], { windowsHide: true })
    let stderr = ''
    child.stderr.on('data', (d) => { stderr += d })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`tar extraction failed with code ${code}: ${stderr}`))
    })
    child.on('error', reject)
  })
}

export async function startSensevoiceInstall(ctx, cfg, updateConfigFn, startSensevoiceFn, options = {}) {
  if (installerState.installing) {
    throw new Error('ASR model installation is already in progress')
  }

  const targetModel = String(options?.model || 'sensevoice').toLowerCase().includes('whisper')
    ? 'whisper-turbo'
    : 'sensevoice'

  installerState = {
    installing: true,
    progress: 5,
    step: 'preparing',
    error: null,
    modelPath: '',
    modelType: targetModel,
  }

  const modelDir = getDefaultModelDir(targetModel)
  const archivePath = path.join(modelDir, `${targetModel}.tar.bz2`)
  const primaryUrl = targetModel === 'whisper-turbo' ? WHISPER_TURBO_MODEL_URL : SENSEVOICE_MODEL_URL
  const mirrorUrl = targetModel === 'whisper-turbo' ? WHISPER_TURBO_MODEL_MIRROR : SENSEVOICE_MODEL_MIRROR

  try {
    await mkdir(modelDir, { recursive: true })
    installerState.step = 'downloading'
    installerState.progress = 10

    let downloadOk = false
    try {
      await downloadArchive(primaryUrl, archivePath, (pct, status) => {
        installerState.progress = pct
        installerState.step = status
      })
      downloadOk = true
    } catch {
      installerState.step = 'downloading (mirror)'
      await downloadArchive(mirrorUrl, archivePath, (pct, status) => {
        installerState.progress = pct
        installerState.step = status
      })
      downloadOk = true
    }

    if (!downloadOk) throw new Error(`Could not download ${targetModel} model from primary or mirror URL`)

    installerState.step = 'verifying checksum'
    installerState.progress = 92
    const expectedHash = MODEL_SHA256[targetModel]
    if (expectedHash) {
      await verifyArchiveSha256(archivePath, expectedHash)
    }

    installerState.step = 'extracting'
    installerState.progress = 95
    await extractTarBz2(archivePath, modelDir)
    await unlink(archivePath).catch(() => {})

    let modelFile = null
    if (targetModel === 'whisper-turbo') {
      const files = findWhisperFiles(modelDir)
      if (!files) throw new Error('whisper-turbo encoder/decoder not found after extraction')
      modelFile = files.encoder
    } else {
      modelFile = findModelFile(modelDir)
      if (!modelFile) throw new Error('model.int8.onnx not found after extraction')
    }

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

    return { ok: true, modelType: targetModel, modelPath: modelFile }
  } catch (err) {
    await unlink(archivePath).catch(() => {})
    installerState.installing = false
    installerState.error = String(err?.message || err)
    installerState.step = 'failed'
    throw err
  }
}

export function registerSensevoiceInstaller(ctx, { liveConfig, isAlive, updateConfig, startSensevoice }) {
  if (!ctx.webServer || typeof ctx.webServer.register !== 'function') return

  return ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-voice/sensevoice-installer',
    handler: async (req, res) => {
      if (!isTrustedCaller(req, { loopbackOnly: true })) {
        writeJson(res, 403, { ok: false, error: 'Forbidden: untrusted caller' })
        return
      }

      if (req.method === 'GET') {
        const status = await getSensevoiceStatus(liveConfig(), isAlive)
        writeJson(res, 200, status)
        return
      }

      if (req.method === 'POST') {
        const safeState = { ...installerState, modelPath: redactModelPath(installerState.modelPath) }
        if (installerState.installing) {
          writeJson(res, 409, { ok: false, error: 'Installation already in progress', state: safeState })
          return
        }

        let bodyObj = {}
        try {
          const raw = await readBody(req, 16384)
          bodyObj = JSON.parse(raw.toString('utf8') || '{}')
        } catch { bodyObj = {} }

        // Start background install
        startSensevoiceInstall(ctx, liveConfig(), updateConfig, startSensevoice, bodyObj).catch((err) => {
          ctx.logger?.warn?.(`ASR 1-click install error: ${String(err)}`)
        })

        writeJson(res, 202, { ok: true, message: 'ASR installation started', state: safeState })
        return
      }

      writeJson(res, 405, { ok: false, error: 'Method not allowed' })
    },
  })
}

export function resolveSensevoiceProvider(cfg) {
  let modelPath = String(cfg?.sensevoiceModel || '')
  const rawProv = String(cfg?.sensevoiceProvider || '').trim().toLowerCase()
  let normProv = rawProv === 'rknpu' ? 'rknn' : rawProv

  if (normProv === 'rknn') {
    const ext = path.extname(modelPath).toLowerCase()
    if (ext === '.onnx') {
      const modelDir = modelPath ? path.dirname(modelPath) : getDefaultModelDir()
      const rknnCandidate = path.join(modelDir, path.basename(modelPath, ext) + '.rknn')
      const defaultRknn = path.join(modelDir, 'model.rknn')
      if (existsSync(rknnCandidate) || existsSync(defaultRknn)) {
        return 'rknn'
      }
      return 'cpu'
    }
    if (ext === '.rknn') {
      if (modelPath && existsSync(modelPath)) {
        return 'rknn'
      }
      return 'cpu'
    }
    return 'cpu'
  }

  if (['cpu', 'openvino', 'coreml', 'cuda'].includes(normProv)) {
    return normProv
  }

  return normProv || 'cpu'
}

export function buildSensevoiceArgs(cfg, port) {
  let modelPath = String(cfg?.sensevoiceModel || '')
  const modelDir = modelPath ? (existsSync(modelPath) ? path.dirname(modelPath) : modelPath) : getDefaultModelDir()
  const effectiveProv = resolveSensevoiceProvider(cfg)
  const provider = (effectiveProv && effectiveProv !== 'cpu') ? ` --provider=${effectiveProv}` : ''
  const threads = Number(cfg?.sensevoiceThreads) || 4

  const whisperFiles = findWhisperFiles(modelDir) || (modelPath ? findWhisperFiles(path.dirname(modelPath)) : null)
  const isWhisper = Boolean(
    whisperFiles ||
    modelPath.toLowerCase().includes('whisper') ||
    modelPath.toLowerCase().includes('turbo')
  )

  if (isWhisper && whisperFiles) {
    const enc = JSON.stringify(whisperFiles.encoder)
    const dec = JSON.stringify(whisperFiles.decoder)
    const tok = whisperFiles.tokens ? ` --tokens=${JSON.stringify(whisperFiles.tokens)}` : ''
    return ` --whisper-encoder=${enc} --whisper-decoder=${dec}${tok} --port=${port} --num-threads=${threads}${provider}`
  }

  if (effectiveProv === 'rknn') {
    const ext = path.extname(modelPath).toLowerCase()
    if (ext === '.onnx') {
      const rknnCandidate = path.join(modelDir, path.basename(modelPath, ext) + '.rknn')
      const defaultRknn = path.join(modelDir, 'model.rknn')
      if (existsSync(rknnCandidate)) modelPath = rknnCandidate
      else if (existsSync(defaultRknn)) modelPath = defaultRknn
    }
  }

  const tokensPath = (cfg?.sensevoiceTokens && existsSync(cfg.sensevoiceTokens))
    ? cfg.sensevoiceTokens
    : findTokensFile(modelDir)
  const tokensArg = tokensPath ? ` --tokens=${JSON.stringify(tokensPath)}` : ''

  return ` --sense-voice-model=${JSON.stringify(modelPath)}${tokensArg} --port=${port} --num-threads=${threads}${provider}`
}
