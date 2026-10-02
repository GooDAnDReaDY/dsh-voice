import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { normalizePhrase } from "../lib/normalize.js";
import { sessionCommand } from "../lib/transcribe-core.js";
import { registerTranscribeAudioTool } from "../lib/tool.js";
import { loadClientPlugin } from "./helpers/load-client.mjs";

const client = loadClientPlugin();
const { voice, extractContextKeywords } = client._test;

// Test normalizePhrase edge cases
test("normalizePhrase handles punctuation and numbers together", () => {
  const input = "встреча в два часа дня , как слышно";
  const output = normalizePhrase(input, {
    digits: true,
    capSentences: true,
    commaSpacing: true,
    trailingPeriod: true,
  });
  assert.equal(output, "Встреча в 2 часа дня, как слышно.");
});

// Test transcribe_audio production tool logic and execution (#214)
test("transcribe_audio tool execution and validation checks (#214)", async () => {
  let registered = null;
  const ctx = {
    tools: {
      register: (tool) => { registered = tool; return () => { registered = null; }; }
    }
  };

  const allowedDir = os.tmpdir();
  registerTranscribeAudioTool(ctx, {
    live: () => ({
      maxFileBytes: 10 * 1024 * 1024,
      allowedAudioRoots: [allowedDir],
      message: { language: 'auto' },
      normalizeTranscript: true,
    }),
    baseConfig: { message: { language: 'auto' } },
    transcribe: async (modeCfg, bytes, mime, signal) => ({
      provider: 'mock-whisper',
      text: 'hello from production tool',
      tookMs: 45,
    }),
    polishText: async (text) => text,
  });

  assert.ok(registered, 'tool must be registered');
  assert.equal(registered.name, 'transcribe_audio');

  const exec = { signal: new AbortController().signal };

  // 1. Missing file_path
  await assert.rejects(
    () => registered.execute({ file_path: '' }, exec),
    /transcribe_audio: file_path is required/
  );

  // 2. Non-existent file
  await assert.rejects(
    () => registered.execute({ file_path: path.join(allowedDir, 'non-existent-audio-file.wav') }, exec),
    /transcribe_audio: file not found/
  );

  // 3. File too small (< 44 bytes)
  const tinyFile = path.join(allowedDir, `tiny-${Date.now()}.wav`);
  fs.writeFileSync(tinyFile, Buffer.alloc(10));
  try {
    await assert.rejects(
      () => registered.execute({ file_path: tinyFile }, exec),
      /transcribe_audio: file is empty or too small/
    );
  } finally {
    try { fs.unlinkSync(tinyFile); } catch {}
  }

  // 4. Valid audio file execution
  const validFile = path.join(allowedDir, `valid-${Date.now()}.wav`);
  const wavHeader = Buffer.from('RIFF....WAVEfmt ....data....', 'ascii');
  const validBytes = Buffer.concat([wavHeader, Buffer.alloc(64, 0)]);
  fs.writeFileSync(validFile, validBytes);
  try {
    const result = await registered.execute({ file_path: validFile }, exec);
    assert.equal(result.provider, 'mock-whisper');
    assert.equal(result.text, 'Hello from production tool.');
    assert.equal(result.tookMs, 45);

    // Test render output
    const rendered = registered.output.render({}, result);
    assert.equal(rendered.length, 1);
    assert.match(rendered[0].text, /transcribe_audio \(mock-whisper, 45ms\)/);
  } finally {
    try { fs.unlinkSync(validFile); } catch {}
  }
});

test("session voice command parser detects clean commands and rejects spoken text via production sessionCommand", () => {
  assert.equal(sessionCommand("отправь!"), "send");
  assert.equal(sessionCommand("Send"), "send");
  assert.equal(sessionCommand("отмена"), "cancel");
  assert.equal(sessionCommand("стоп."), "stop");
  assert.equal(sessionCommand("продолжай"), "continue");

  // Multi-word / normal sentences must NOT match
  assert.equal(sessionCommand("отправь мне отчет пожалуйста"), null);
  assert.equal(sessionCommand("не отменяй заказ"), null);
  assert.equal(sessionCommand("стоп машина"), null);
});

test("extractContextKeywords extracts technical tokens while skipping stop words via production helper", () => {
  voice.settings.contextGlossary = true;
  voice.input = { draft: "Refactor the docker container and python function in TypeScript." };
  const words = extractContextKeywords();

  assert.ok(words.includes("Refactor"));
  assert.ok(words.includes("docker"));
  assert.ok(words.includes("container"));
  assert.ok(words.includes("python"));
  assert.ok(words.includes("function"));
  assert.ok(words.includes("TypeScript"));
  assert.ok(!words.includes("the"));
  assert.ok(!words.includes("and"));
});
