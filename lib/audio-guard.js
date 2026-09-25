import path from 'node:path'
import os from 'node:os'
import { realpath } from 'node:fs/promises'

/**
 * Check whether a target path is strictly located within any of the allowed root directories.
 * Boundary-aware prefix match: /tmp does not allow /tmp-other.
 * @param {string} targetPath
 * @param {string[]} allowedRoots
 * @returns {boolean}
 */
export function isPathUnderRoots(targetPath, allowedRoots) {
  if (!targetPath || !Array.isArray(allowedRoots) || allowedRoots.length === 0) return false
  const normalized = path.resolve(targetPath)

  return allowedRoots.some((root) => {
    if (!root) return false
    const normRoot = path.resolve(root)
    if (normalized === normRoot) return true
    const prefix = normRoot.endsWith(path.sep) ? normRoot : normRoot + path.sep
    return normalized.startsWith(prefix)
  })
}

/**
 * Return allowed root directories for the transcribe_audio tool.
 * Combines configured audio directories with standard safe locations (.dsh, tmpdir, cwd).
 * @param {object} [cfg]
 * @returns {string[]}
 */
export function getAllowedAudioRoots(cfg) {
  const custom = Array.isArray(cfg?.allowedAudioDirs) ? cfg.allowedAudioDirs : []
  const defaults = [
    os.tmpdir(),
    path.join(os.homedir(), '.dsh'),
    process.cwd(),
  ]
  return [...custom, ...defaults].map((d) => path.resolve(String(d)))
}

/**
 * Validate audio path before access:
 * 1. Checks lexical path boundary before calling stat or read.
 * 2. Checks realpath to prevent symlink traversal escapes.
 * @param {string} filePath
 * @param {string[]} allowedRoots
 * @returns {Promise<{ resolved: string, real: string }>}
 */
export async function validateAudioPath(filePath, allowedRoots) {
  const raw = String(filePath || '').trim()
  if (!raw) {
    throw new Error('transcribe_audio: file_path is required')
  }

  const resolved = path.resolve(raw)
  if (!isPathUnderRoots(resolved, allowedRoots)) {
    throw new Error(`transcribe_audio: path is outside allowed audio directories: ${raw}`)
  }

  let real = ''
  try {
    real = await realpath(resolved)
  } catch (err) {
    throw new Error(`transcribe_audio: file not found: ${raw}`)
  }

  if (!isPathUnderRoots(real, allowedRoots)) {
    throw new Error(`transcribe_audio: resolved symlink is outside allowed audio directories: ${raw}`)
  }

  return { resolved, real }
}

/**
 * Sniff audio format from magic bytes.
 * Supports WAV, MP3, OGG, FLAC, WebM, and M4A/MP4.
 * @param {Buffer|Uint8Array} buffer
 * @returns {string|null} Detected MIME type or null
 */
export function sniffAudioFormat(buffer) {
  if (!buffer || buffer.length < 4) return null

  // WAV: 'RIFF' .... 'WAVE'
  if (buffer.length >= 12) {
    const riff = String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3])
    const wave = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11])
    if (riff === 'RIFF' && wave === 'WAVE') return 'audio/wav'
  }

  // OGG: 'OggS'
  if (String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]) === 'OggS') {
    return 'audio/ogg'
  }

  // FLAC: 'fLaC'
  if (String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]) === 'fLaC') {
    return 'audio/flac'
  }

  // WebM / Matroska: 0x1A 0x45 0xDF 0xA3 (EBML)
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return 'audio/webm'
  }

  // MP3: ID3 header or frame sync 0xFF 0xFB/F3/F2
  if (buffer.length >= 3 && String.fromCharCode(buffer[0], buffer[1], buffer[2]) === 'ID3') {
    return 'audio/mpeg'
  }
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return 'audio/mpeg'
  }

  // M4A / MP4: '....ftyp'
  if (buffer.length >= 8) {
    const ftyp = String.fromCharCode(buffer[4], buffer[5], buffer[6], buffer[7])
    if (ftyp === 'ftyp') return 'audio/mp4'
  }

  return null
}

/**
 * Enforce audio MIME/content validation independently of file extension.
 * @param {Buffer|Uint8Array} buffer
 * @returns {string} Detected audio MIME type
 */
export function validateAudioContent(buffer) {
  const mime = sniffAudioFormat(buffer)
  if (!mime) {
    throw new Error('transcribe_audio: unsupported or invalid audio file format (magic bytes check failed)')
  }
  return mime
}
