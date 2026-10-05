// lib/client-src/35-webgpu.js — Client-side WebGPU/WASM Whisper offline recognition
// Detects WebGPU and WebAssembly availability in browser and provides offline transcription with graceful WASM fallback.

function isWebGpuSupported() {
  if (typeof navigator === 'undefined' || !navigator.gpu) return false
  return true
}

function isWasmSupported() {
  return typeof WebAssembly !== 'undefined'
}

function isOfflineSupported() {
  return isWebGpuSupported() || isWasmSupported()
}

const _webGpuPipelines = new Map()

function loadWebGpuWhisper(modelName, options) {
  const targetModel = modelName || (voice.settings && voice.settings.webgpuModel) || 'onnx-community/whisper-tiny'
  const forceDevice = options?.device
  const key = `${targetModel}:${forceDevice || 'auto'}`
  if (_webGpuPipelines.has(key)) {
    return _webGpuPipelines.get(key)
  }
  const promise = (async () => {
    if (!isOfflineSupported()) {
      throw new Error('Neither WebGPU nor WebAssembly is supported in this browser environment')
    }
    const mod = typeof globalThis !== 'undefined' && globalThis.__mockTransformers
      ? globalThis.__mockTransformers
      : (await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3'))
    const pipeline = mod.pipeline || (mod.default && mod.default.pipeline)
    if (!pipeline) throw new Error('Transformers pipeline not found in loaded bundle')

    // Prefer WebGPU if available and not forced to wasm; fall back to WASM on error or when WebGPU is absent
    const canGpu = forceDevice === 'webgpu' || (!forceDevice && isWebGpuSupported())
    if (canGpu) {
      try {
        return await pipeline('automatic-speech-recognition', targetModel, {
          device: 'webgpu',
          dtype: 'fp32',
        })
      } catch (gpuErr) {
        if (isWasmSupported()) {
          return await pipeline('automatic-speech-recognition', targetModel, {
            device: 'wasm',
            dtype: 'q8',
          })
        }
        throw gpuErr
      }
    }

    if (isWasmSupported()) {
      return await pipeline('automatic-speech-recognition', targetModel, {
        device: 'wasm',
        dtype: 'q8',
      })
    }

    throw new Error('Offline speech recognition failed: no WebGPU or WebAssembly available')
  })().catch((err) => {
    _webGpuPipelines.delete(key)
    throw err
  })
  _webGpuPipelines.set(key, promise)
  return promise
}

async function audioBlobToFloat32Array(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const AC = typeof AudioContext !== 'undefined' ? AudioContext
    : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null)
  if (!AC) throw new Error('AudioContext unavailable for audio decoding')
  const ctx = new AC({ sampleRate: 16000 })
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    return audioBuffer.getChannelData(0)
  } finally {
    try { await ctx.close() } catch (_) {}
  }
}

async function transcribeWithWebGpu(blob, mime, options) {
  if (!isOfflineSupported()) {
    throw new Error('Offline recognition (WebGPU/WASM) unavailable in browser')
  }
  const transcriber = await loadWebGpuWhisper(options && options.model, options)
  const audioData = await audioBlobToFloat32Array(blob)
  const generateArgs = {}
  if (options && options.language && options.language !== 'auto') {
    generateArgs.language = options.language
  }
  const result = await transcriber(audioData, generateArgs)
  const text = (result && typeof result.text === 'string') ? result.text.trim() : ''
  return { text, provider: 'browser-webgpu' }
}

voice.webGpu = {
  isSupported: isOfflineSupported,
  isWebGpuSupported,
  isWasmSupported,
  transcribe: transcribeWithWebGpu,
  load: loadWebGpuWhisper,
  clearCache: () => { _webGpuPipelines.clear() },
}
