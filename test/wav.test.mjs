import test from "node:test";
import assert from "node:assert/strict";
import { toWav16k } from "../lib/wav.js";

test("toWav16k fails on non-existent ffmpeg binary", async () => {
  const dummy = Buffer.from([1, 2, 3, 4]);
  await assert.rejects(
    async () => {
      await toWav16k(dummy, "non_existent_ffmpeg_bin_12345");
    },
    /ffmpeg unavailable:/
  );
});

test("toWav16k converts audio to valid 16kHz mono WAV via ffmpeg", async () => {
  // Synthesize minimal 100ms 8000Hz PCM WAV header + silence
  const sampleRate = 8000;
  const numSamples = 800; // 0.1s
  const byteRate = sampleRate * 2;
  const blockAlign = 2;
  const dataSize = numSamples * 2;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // subchunk1size PCM
  header.writeUInt16LE(1, 20); // audio format PCM
  header.writeUInt16LE(1, 22); // num channels = 1
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  const pcm = Buffer.alloc(dataSize, 0);
  const inputAudio = Buffer.concat([header, pcm]);

  const outputWav = await toWav16k(inputAudio, "ffmpeg");
  assert.ok(Buffer.isBuffer(outputWav), "output is a Buffer");
  assert.ok(outputWav.length >= 44, "has wav header");
  assert.equal(outputWav.toString("ascii", 0, 4), "RIFF");
  assert.equal(outputWav.toString("ascii", 8, 12), "WAVE");

  // Verify sample rate in output header is 16000 (offset 24, 4 bytes uint32 LE)
  const outSampleRate = outputWav.readUInt32LE(24);
  assert.equal(outSampleRate, 16000, "converted sample rate is 16000 Hz");

  // Verify channels = 1 (offset 22, 2 bytes uint16 LE)
  const outChannels = outputWav.readUInt16LE(22);
  assert.equal(outChannels, 1, "converted channels is mono (1)");
});

test("toWav16k rejects when ffmpeg exits with error on garbage data", async () => {
  const garbage = Buffer.from("this is definitely not a valid audio container");
  await assert.rejects(
    async () => {
      await toWav16k(garbage, "ffmpeg");
    },
    /ffmpeg exit/
  );
});
