// Перегон произвольного аудио в WAV 16 кГц моно.
//
// Локальный whisper.cpp принимает только WAV: на webm/opus, который пишет
// браузер, его сервер отвечает "Invalid request". API-провайдеры webm едят
// как есть, поэтому конвертация нужна ровно для локальной ноги цепочки.

import { spawn } from 'node:child_process'

/**
 * @param bytes {Buffer|Uint8Array} исходное аудио в любом контейнере
 * @param ffmpegBin {string} путь к ffmpeg
 * @returns {Promise<Buffer>} WAV 16 кГц моно
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
    proc.stdin.on('error', () => { /* ffmpeg закрыл вход раньше — код возврата всё расскажет */ })
    proc.stdin.end(Buffer.from(bytes))
  })
}
