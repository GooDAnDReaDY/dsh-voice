import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  isPathUnderRoots,
  getAllowedAudioRoots,
  validateAudioPath,
  sniffAudioFormat,
  validateAudioContent,
} from '../lib/audio-guard.js'

test('isPathUnderRoots enforces boundary-aware directory matching', () => {
  const roots = ['/tmp/safe', '/home/user/.dsh']
  assert.equal(isPathUnderRoots('/tmp/safe/audio.wav', roots), true)
  assert.equal(isPathUnderRoots('/tmp/safe/sub/audio.wav', roots), true)
  assert.equal(isPathUnderRoots('/tmp/safe', roots), true)

  // Sibling prefix escape must NOT be allowed
  assert.equal(isPathUnderRoots('/tmp/safe-escape/audio.wav', roots), false)
  assert.equal(isPathUnderRoots('/tmp/safe_other/file.wav', roots), false)
  assert.equal(isPathUnderRoots('/etc/passwd', roots), false)
  assert.equal(isPathUnderRoots(null, roots), false)
  assert.equal(isPathUnderRoots('/tmp/safe/audio.wav', []), false)
})

test('getAllowedAudioRoots includes tmpdir, ~/.dsh, cwd and custom dirs', () => {
  const roots = getAllowedAudioRoots({ allowedAudioDirs: ['/mnt/recordings'] })
  assert.ok(roots.includes(path.resolve(os.tmpdir())))
  assert.ok(roots.includes(path.resolve(path.join(os.homedir(), '.dsh'))))
  assert.ok(roots.includes(path.resolve(process.cwd())))
  assert.ok(roots.includes(path.resolve('/mnt/recordings')))
})

test('validateAudioPath rejects outside-root paths before stat or read (#152)', async () => {
  const safeRoot = path.join(os.tmpdir(), `dsh-safe-root-${Date.now()}`)
  fs.mkdirSync(safeRoot, { recursive: true })
  try {
    // 1. Outside root path is rejected
    await assert.rejects(
      () => validateAudioPath('/etc/passwd', [safeRoot]),
      /transcribe_audio: path is outside allowed audio directories/
    )

    // 2. Traversal path (../..) outside root is rejected
    const traversal = path.join(safeRoot, '..', '..', 'etc', 'passwd')
    await assert.rejects(
      () => validateAudioPath(traversal, [safeRoot]),
      /transcribe_audio: path is outside allowed audio directories/
    )

    // 3. Non-existent file under safe root throws not found
    const missing = path.join(safeRoot, 'missing.wav')
    await assert.rejects(
      () => validateAudioPath(missing, [safeRoot]),
      /transcribe_audio: file not found/
    )

    // 4. Valid file under safe root succeeds
    const legit = path.join(safeRoot, 'legit.wav')
    fs.writeFileSync(legit, Buffer.alloc(100))
    const res = await validateAudioPath(legit, [safeRoot])
    assert.equal(res.real, fs.realpathSync(legit))
  } finally {
    fs.rmSync(safeRoot, { recursive: true })
  }
})

test('validateAudioPath rejects symlink escapes outside allowed roots (#152)', async () => {
  const safeRoot = path.join(os.tmpdir(), `dsh-symlink-root-${Date.now()}`)
  const outsideDir = path.join(os.tmpdir(), `dsh-symlink-outside-${Date.now()}`)
  fs.mkdirSync(safeRoot, { recursive: true })
  fs.mkdirSync(outsideDir, { recursive: true })

  const outsideFile = path.join(outsideDir, 'secret.wav')
  fs.writeFileSync(outsideFile, 'secret content')

  const symlinkPath = path.join(safeRoot, 'symlink-to-outside.wav')
  try {
    fs.symlinkSync(outsideFile, symlinkPath)
    await assert.rejects(
      () => validateAudioPath(symlinkPath, [safeRoot]),
      /transcribe_audio: resolved symlink is outside allowed audio directories/
    )
  } catch (err) {
    // On systems where symlink creation requires admin privileges, skip symlink test
    if (err.code !== 'EPERM') throw err
  } finally {
    fs.rmSync(safeRoot, { recursive: true })
    fs.rmSync(outsideDir, { recursive: true })
  }
})

test('sniffAudioFormat identifies magic bytes for all supported audio types', () => {
  // WAV: RIFF....WAVE
  const wavBuf = Buffer.alloc(44)
  wavBuf.write('RIFF', 0, 'ascii')
  wavBuf.write('WAVE', 8, 'ascii')
  assert.equal(sniffAudioFormat(wavBuf), 'audio/wav')

  // MP3: ID3 or sync frame
  const id3Buf = Buffer.alloc(32)
  id3Buf.write('ID3', 0, 'ascii')
  assert.equal(sniffAudioFormat(id3Buf), 'audio/mpeg')

  const mp3Sync = Buffer.from([0xff, 0xfb, 0x90, 0x64])
  assert.equal(sniffAudioFormat(mp3Sync), 'audio/mpeg')

  // OGG: OggS
  const oggBuf = Buffer.alloc(32)
  oggBuf.write('OggS', 0, 'ascii')
  assert.equal(sniffAudioFormat(oggBuf), 'audio/ogg')

  // FLAC: fLaC
  const flacBuf = Buffer.alloc(32)
  flacBuf.write('fLaC', 0, 'ascii')
  assert.equal(sniffAudioFormat(flacBuf), 'audio/flac')

  // WebM: 0x1A 0x45 0xDF 0xA3
  const webmBuf = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00])
  assert.equal(sniffAudioFormat(webmBuf), 'audio/webm')

  // M4A: ....ftyp
  const m4aBuf = Buffer.alloc(32)
  m4aBuf.write('ftyp', 4, 'ascii')
  assert.equal(sniffAudioFormat(m4aBuf), 'audio/mp4')

  // Non-audio inputs return null
  assert.equal(sniffAudioFormat(Buffer.from('root:x:0:0:root:/root:/bin/bash')), null)
  assert.equal(sniffAudioFormat(Buffer.from('{"key": "value"}')), null)
  assert.equal(sniffAudioFormat(Buffer.alloc(2)), null)
  assert.equal(sniffAudioFormat(null), null)
})

test('validateAudioContent validates content independently of file extension (#152)', () => {
  // Real WAV buffer passes
  const legitWav = Buffer.alloc(44)
  legitWav.write('RIFF', 0, 'ascii')
  legitWav.write('WAVE', 8, 'ascii')
  assert.equal(validateAudioContent(legitWav), 'audio/wav')

  // Plain text masquerading as audio throws validation error
  const textMasqueradingAsWav = Buffer.from('hello world, this is a plain text file pretending to be audio')
  assert.throws(
    () => validateAudioContent(textMasqueradingAsWav),
    /transcribe_audio: unsupported or invalid audio file format \(magic bytes check failed\)/
  )
})
