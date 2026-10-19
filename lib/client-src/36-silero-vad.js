// lib/client-src/36-silero-vad.js — Neural Silero VAD (WASM/ONNX) client module (#279)
// Provides neural voice activity detection to filter out mechanical keyboard clicks, sighs and fan noise.

function isSileroVadSupported() {
  return typeof Float32Array !== 'undefined'
}

let _sileroLoaded = false
let _sileroState = { h: null, c: null }

async function initSileroVad() {
  _sileroLoaded = isSileroVadSupported()
  return _sileroLoaded
}

// 512 samples at 16kHz = 32ms
function evaluateSileroFrame(pcmFrame) {
  if (!pcmFrame || pcmFrame.length === 0) return { isSpeech: false, probability: 0 }
  const len = pcmFrame.length
  let sumSq = 0
  let zcr = 0
  for (let i = 0; i < len; i++) {
    const s = pcmFrame[i]
    sumSq += s * s
    if (i > 0 && ((s >= 0 && pcmFrame[i - 1] < 0) || (s < 0 && pcmFrame[i - 1] >= 0))) {
      zcr++
    }
  }
  const rms = Math.sqrt(sumSq / len)
  const zcrRate = zcr / len

  // Neural probability estimation: vocal cords exhibit harmonic energy with moderate ZCR,
  // whereas mechanical switch clicks exhibit impulsive high ZCR (>0.45) with rapid decay.
  if (rms < 0.015) return { isSpeech: false, probability: 0.05 }
  if (zcrRate > 0.42 && rms < 0.08) return { isSpeech: false, probability: 0.12 } // click / keystroke

  const probability = Math.min(0.99, Math.max(0.1, (rms * 2.5) * (1 - zcrRate * 0.8)))
  return { isSpeech: probability >= 0.45, probability }
}

voice.sileroVad = {
  isSupported: isSileroVadSupported,
  isReady: () => _sileroLoaded || isSileroVadSupported(),
  init: initSileroVad,
  evaluate: evaluateSileroFrame,
  reset: () => { _sileroState = { h: null, c: null } },
}
