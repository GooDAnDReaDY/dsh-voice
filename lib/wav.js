// Convert arbitrary audio to 16 kHz mono WAV.
//
// Local whisper.cpp accepts WAV only: browser webm/opus gets "Invalid
// request". Cloud providers accept webm as-is, so conversion is only needed
// for the local leg of the chain.

import { spawn } from 'node:child_process'

/**
 * @param bytes {Buffer|Uint8Array} source audio in any container
 * @param ffmpegBin {string} ffmpeg binary path
 * @returns {Promise<Buffer>} 16 kHz mono WAV
 */
export function toWav16k(bytes, ffmpegBin = 'ffmpeg', signal = null) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('ffmpeg conversion aborted before start'))
      return
    }
    const proc = spawn(ffmpegBin, [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-ar', '16000', '-ac', '1',
      '-f', 'wav', 'pipe:1',
    ], {
      windowsHide: true,
    })
    const out = []
    const err = []
    let done = false

    const timeout = setTimeout(() => {
      cleanup()
      try { proc.kill('SIGKILL') } catch (e) { /* process already exited */ }
      reject(new Error('ffmpeg conversion timed out after 30s'))
    }, 30000)

    const onAbort = () => {
      cleanup()
      try { proc.kill('SIGKILL') } catch (e) { /* process already exited */ }
      reject(new Error('ffmpeg conversion aborted'))
    }

    if (signal) signal.addEventListener('abort', onAbort, { once: true })

    function cleanup() {
      if (done) return
      done = true
      clearTimeout(timeout)
      if (signal) signal.removeEventListener('abort', onAbort)
    }

    proc.stdout.on('data', (c) => out.push(c))
    proc.stderr.on('data', (c) => err.push(c))
    proc.on('error', (e) => {
      cleanup()
      reject(new Error(`ffmpeg unavailable: ${e.message}`))
    })
    proc.on('close', (code) => {
      cleanup()
      if (code !== 0) {
        reject(new Error(`ffmpeg exit ${code}: ${Buffer.concat(err).toString('utf8').slice(0, 200)}`))
        return
      }
      const wav = Buffer.concat(out)
      if (wav.length < 64) { reject(new Error('ffmpeg produced empty output')); return }
      resolve(wav)
    })
    proc.stdin.on('error', () => { /* ffmpeg closed stdin early — the exit code tells the story */ })
    proc.stdin.end(Buffer.from(bytes))
  })
}

/**
 * Generate a synthetic PCM 16-bit mono WAV buffer (silence).
 * Used for express hardware benchmarking and latency profiling without external files.
 * @param {number} durationSeconds
 * @param {number} sampleRate
 * @returns {Buffer}
 */
export function createSyntheticWav(durationSeconds = 1.0, sampleRate = 16000) {
  const numSamples = Math.max(1, Math.floor(durationSeconds * sampleRate))
  const dataSize = numSamples * 2
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM format
  buf.writeUInt16LE(1, 22) // Mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28) // Byte rate
  buf.writeUInt16LE(2, 32) // Block align
  buf.writeUInt16LE(16, 34) // 16-bit
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  return buf
}
