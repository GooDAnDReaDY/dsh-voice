// lib/client-src/35-webgpu.js — Client-side WebGPU Whisper offline recognition
// Detects WebGPU availability in browser and provides offline transcription with graceful fallback.

function isWebGpuSupported() {
  if (typeof navigator === 'undefined' || !navigator.gpu) return false
  return true
}

let _webGpuPipeline = null
let _webGpuLoading = false

async function loadWebGpuWhisper(modelName) {
  if (_webGpuPipeline) return _webGpuPipeline
  if (_webGpuLoading) {
    while (_webGpuLoading) {
      await new Promise((r) => setTimeout(r, 80))
    }
    if (_webGpuPipeline) return _webGpuPipeline
  }
  _webGpuLoading = true
  try {
    if (!isWebGpuSupported()) {
      throw new Error('WebGPU is not supported in this browser environment')
    }
    // Dynamic import of transformers.js from ESM CDN
    const mod = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3')
    const pipeline = mod.pipeline || (mod.default && mod.default.pipeline)
    if (!pipeline) throw new Error('Transformers pipeline not found in loaded bundle')
    const targetModel = modelName || (voice.settings && voice.settings.webgpuModel) || 'onnx-community/whisper-tiny'
    _webGpuPipeline = await pipeline('automatic-speech-recognition', targetModel, {
      device: 'webgpu',
      dtype: 'fp32',
    })
    return _webGpuPipeline
  } finally {
    _webGpuLoading = false
  }
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
  if (!isWebGpuSupported()) {
    throw new Error('WebGPU unavailable in browser')
  }
  const transcriber = await loadWebGpuWhisper(options && options.model)
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
  isSupported: isWebGpuSupported,
  transcribe: transcribeWithWebGpu,
}
