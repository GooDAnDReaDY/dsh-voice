import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

test("lib/client.js contains unified clinebot design classes and ErrorBoundary", () => {
  const clientPath = path.join(rootDir, "lib", "client.js");
  assert.ok(fs.existsSync(clientPath), "lib/client.js should exist");
  const content = fs.readFileSync(clientPath, "utf8");

  assert.ok(content.includes(".cb-page"), "has .cb-page class");
  assert.ok(content.includes(".cb-section-card"), "has .cb-section-card class");
  assert.ok(content.includes(".cb-badge"), "has .cb-badge class");
  assert.ok(content.includes(".cb-btn-primary"), "has .cb-btn-primary class");
  assert.ok(content.includes("createErrorBoundary"), "has createErrorBoundary helper");
  assert.ok(content.includes("/dsh-voice/status"), "fetches /dsh-voice/status");
  assert.ok(content.includes("AbortController"), "uses AbortController for fetch timeout");
  assert.ok(content.includes(".dvo-wave{flex:1;min-width:0;max-width:100%"), "prevents canvas overflow with min-width:0 and max-width:100%");
});

test("lib/index.js registers correct routes and tool names", () => {
  const indexPath = path.join(rootDir, "lib", "index.js");
  assert.ok(fs.existsSync(indexPath), "lib/index.js should exist");
  const content = fs.readFileSync(indexPath, "utf8");

  assert.ok(content.includes("path: '/dsh-voice/status'"), "registers /dsh-voice/status route");
  assert.ok(content.includes("path: '/dsh-voice/polish'"), "registers /dsh-voice/polish route");
  assert.ok(content.includes("path: '/dsh-voice/transcribe'"), "registers /dsh-voice/transcribe route");
  assert.ok(content.includes("name: 'transcribe_audio'"), "registers transcribe_audio tool");
  assert.ok(content.includes("kind: 'exact'"), "registers route kinds as exact");
});
