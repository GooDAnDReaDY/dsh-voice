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
export function toWav16k(bytes, ffmpegBin = 'ffmpeg') {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin, [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-ar', '16000', '-ac', '1',
      '-f', 'wav', 'pipe:1',
    ])
    const out = []
    const err = []
    proc.stdout.on('data', (c) => out.push(c))
    proc.stderr.on('data', (c) => err.push(c))
    proc.on('error', (e) => reject(new Error(`ffmpeg unavailable: ${e.message}`)))
    proc.on('close', (code) => {
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
