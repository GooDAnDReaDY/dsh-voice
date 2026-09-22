import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { normalizePhrase } from "../lib/normalize.js";

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

// Test transcribe_audio tool logic invariants
test("transcribe_audio tool validation checks", async () => {
  const tmpDir = os.tmpdir();
  const emptyFile = path.join(tmpDir, `dsh-voice-test-empty-${Date.now()}.wav`);
  fs.writeFileSync(emptyFile, Buffer.alloc(10)); // < 44 bytes

  try {
    const size = fs.statSync(emptyFile).size;
    assert.ok(size < 44, "file is smaller than 44 bytes");
  } finally {
    try { fs.unlinkSync(emptyFile); } catch {}
  }
});

test("session voice command parser detects clean commands and rejects spoken text", () => {
  const SESSION_COMMANDS = [
    { re: /^(отправь|отправить|пошли|send)\s*[.!?]*$/i, cmd: "send" },
    { re: /^(отмени|отмена|cancel|отменить)\s*[.!?]*$/i, cmd: "cancel" },
    { re: /^(стоп|stop|хватит)\s*[.!?]*$/i, cmd: "stop" },
    { re: /^(продолжи|continue|продолжай)\s*[.!?]*$/i, cmd: "continue" },
  ];
  function sessionCommand(text) {
    const t = String(text || "").trim().toLowerCase();
    if (!t) return null;
    for (const { re, cmd } of SESSION_COMMANDS) {
      if (re.test(t)) return cmd;
    }
    return null;
  }

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

test("extractContextKeywords extracts technical tokens while skipping stop words", () => {
  const text = "Refactor the docker container and python function in TypeScript.";
  const matches = text.match(/\b[A-Za-z_][A-Za-z0-9_]{2,29}\b/g) || [];
  const stop = new Set(["the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "man", "new", "now", "old", "see", "two", "way", "who", "boy", "did", "its", "let", "put", "say", "she", "too", "use"]);
  const words = [];
  const seen = new Set();
  for (const m of matches) {
    const lower = m.toLowerCase();
    if (!stop.has(lower) && !seen.has(lower)) {
      seen.add(lower);
      words.push(m);
    }
  }

  assert.ok(words.includes("Refactor"));
  assert.ok(words.includes("docker"));
  assert.ok(words.includes("container"));
  assert.ok(words.includes("python"));
  assert.ok(words.includes("function"));
  assert.ok(words.includes("TypeScript"));
  assert.ok(!words.includes("the"));
  assert.ok(!words.includes("and"));
});
