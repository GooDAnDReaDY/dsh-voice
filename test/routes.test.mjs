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
  assert.ok(content.includes("/dsh-voice/config"), "fetches and saves /dsh-voice/config");
  assert.ok(content.includes("AbortController"), "uses AbortController for fetch timeout");
  assert.ok(content.includes(".dvo-wave{flex:1;min-width:0;max-width:100%"), "prevents canvas overflow with min-width:0 and max-width:100%");
});

test("lib/index.js registers correct routes and tool names", () => {
  const indexPath = path.join(rootDir, "lib", "index.js");
  assert.ok(fs.existsSync(indexPath), "lib/index.js should exist");
  const hostRoutesPath = path.join(rootDir, "lib", "host-routes.js");
  const content = fs.readFileSync(indexPath, "utf8") + (fs.existsSync(hostRoutesPath) ? fs.readFileSync(hostRoutesPath, "utf8") : "");

  assert.ok(content.includes("path: '/dsh-voice/status'"), "registers /dsh-voice/status route");
  assert.ok(content.includes("registerConfigRoutes"), "registers config route handler");
  assert.ok(content.includes("path: '/dsh-voice/polish'"), "registers /dsh-voice/polish route");
  assert.ok(content.includes("path: '/dsh-voice/transcribe'"), "registers /dsh-voice/transcribe route");
  assert.ok(content.includes("name: 'transcribe_audio'"), "registers transcribe_audio tool");
  assert.ok(content.includes("kind: 'exact'"), "registers route kinds as exact");
  assert.ok(content.includes("noiseGateDb: cfg.noiseGateDb"), "status route emits noiseGateDb");
  assert.ok(content.includes("whisperRunning: whisperOk"), "status route emits whisperRunning");
  assert.ok(content.includes("whisperError: whisperOk ? null : whisperError"), "status route emits whisperError");
  assert.ok(content.includes("sensevoiceRunning: sensevoiceOk"), "status route emits sensevoiceRunning");
  assert.ok(content.includes("sensevoiceError: sensevoiceOk ? null : sensevoiceError"), "status route emits sensevoiceError");
  assert.ok(content.includes("export const NS = 'dsh-voice'"), "exports canonical NS");
  assert.ok(content.includes("sctx.settings.register(NS, Config"), "registers settings with canonical NS");
});

test("toWav16k rejects immediately when signal is already aborted", async () => {
  const { toWav16k } = await import("../lib/wav.js");
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => toWav16k(Buffer.from([0, 1, 2, 3]), "ffmpeg", controller.signal),
    /aborted/
  );
});

test("package name is consistently '@goodandready/dsh-voice' across all surfaces", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  assert.equal(pkg.name, "@goodandready/dsh-voice");

  const cordisPatch = fs.readFileSync(path.join(rootDir, "cordis.patch.yml"), "utf8");
  assert.ok(cordisPatch.includes("name: '@goodandready/dsh-voice'"), "cordis.patch.yml must match package name");

  const indexPath = path.join(rootDir, "lib", "index.js");
  const indexContent = fs.readFileSync(indexPath, "utf8");
  assert.ok(indexContent.includes("export const name = '@goodandready/dsh-voice'"), "lib/index.js export const name must match package name");

  const clientPath = path.join(rootDir, "lib", "client.js");
  const clientContent = fs.readFileSync(clientPath, "utf8");
  assert.ok(clientContent.includes("id: '@goodandready/dsh-voice'"), "lib/client.js plugin id must match package name");
});

test("lib/client.js adheres to zero hardcoded colors rule (no rgba, no hex literals)", () => {
  const clientPath = path.join(rootDir, "lib", "client.js");
  const content = fs.readFileSync(clientPath, "utf8");
  const rgbaMatches = content.match(/rgba\(/g) || [];
  const hexMatches = content.match(/#[0-9a-fA-F]{6}/g) || [];
  assert.equal(rgbaMatches.length, 0, "must have zero rgba( color occurrences");
  assert.equal(hexMatches.length, 0, "must have zero 6-digit hex color occurrences");
});

test("lib/client.js includes core chevron primitive with fallback and accessible composer pill", () => {
  const clientPath = path.join(rootDir, "lib", "client.js");
  const content = fs.readFileSync(clientPath, "utf8");

  assert.ok(content.includes("IconChevronDownOutline14"), "queries IconChevronDownOutline14 from primitives");
  assert.ok(content.includes("dvo-chev-icon"), "renders chevron icon with fallback class");
  assert.ok(content.includes("aria-live"), "pill status uses aria-live polite");
  assert.ok(content.includes("role: 'region'"), "pill uses role region");
  assert.ok(content.includes("focusComposer"), "focusComposer returns focus after cancel/stop");
});





test("lib/client.js localizes jargon placeholder without hardcoded Russian literals (#151)", () => {
  const clientPath = path.join(rootDir, "lib", "client.js");
  const content = fs.readFileSync(clientPath, "utf8");

  assert.ok(!content.includes("кубик -> k8s"), "jargon editor must not hardcode Russian placeholder");
  assert.ok(content.includes("jargonPlaceholder"), "uses jargonPlaceholder key");
  assert.ok(content.includes("k8s -> kubernetes"), "contains localized example string");
});


test("host routes behavioral execution: /status, /polish, /transcribe error and edge paths (#97)", async () => {
  const { apply, BaseConfig } = await import("../lib/index.js");
  const { mockReq, mockRes, jsonBody, mockOversizedReq } = await import("./helpers/mock-http.mjs");

  const routes = {};
  const mockCtx = {
    effect: (fn) => fn(),
    inject: (deps, fn) => {
      if (deps.includes('settings')) {
        fn({
          settings: {
            register: () => ({ get: () => BaseConfig(), watch: () => {} }),
          },
          effect: (f) => f(),
        });
      }
    },
    webServer: {
      register: (def) => {
        routes[def.path] = def.handler;
        return () => { delete routes[def.path]; };
      },
    },
    tools: { register: () => () => {} },
    credentials: { resolve: async () => null },
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    on: () => {},
    shell: { resolve: () => ({ command: '' }), execute: () => ({}) },
  };

  apply(mockCtx, BaseConfig());

  assert.ok(routes['/dsh-voice/status'], 'must register /dsh-voice/status');
  assert.ok(routes['/dsh-voice/polish'], 'must register /dsh-voice/polish');
  assert.ok(routes['/dsh-voice/transcribe'], 'must register /dsh-voice/transcribe');

  // 1. /status GET returns 200 with status payload
  const statusReq = mockReq('GET');
  const statusRes = mockRes();
  await routes['/dsh-voice/status'](statusReq, statusRes);
  assert.equal(statusRes.statusCode, 200);
  const statusPayload = jsonBody(statusRes);
  assert.equal(statusPayload.ok, true);
  assert.ok('whisperRunning' in statusPayload);
  assert.ok('sensevoiceRunning' in statusPayload);
  assert.ok('noiseGateDb' in statusPayload);

  // 2. /polish method guard: non-POST returns 405
  const polishGetReq = mockReq('GET');
  const polishGetRes = mockRes();
  await routes['/dsh-voice/polish'](polishGetReq, polishGetRes);
  assert.equal(polishGetRes.statusCode, 405);
  assert.equal(jsonBody(polishGetRes).error.code, 'method');

  // 3. /polish origin guard: untrusted origin returns 403
  const polishCrossReq = mockReq('POST', JSON.stringify({ text: 'test' }), {
    'sec-fetch-site': 'cross-site',
    'origin': 'https://attacker.example',
    'host': '127.0.0.1:3000',
  });
  polishCrossReq.socket = { remoteAddress: '198.51.100.1' };
  polishCrossReq.fire();
  const polishCrossRes = mockRes();
  await routes['/dsh-voice/polish'](polishCrossReq, polishCrossRes);
  assert.equal(polishCrossRes.statusCode, 403);
  assert.equal(jsonBody(polishCrossRes).error.code, 'forbidden');

  // 4. /polish empty or missing text returns 400
  const polishEmptyReq = mockReq('POST', JSON.stringify({ text: '   ' }));
  polishEmptyReq.fire();
  const polishEmptyRes = mockRes();
  await routes['/dsh-voice/polish'](polishEmptyReq, polishEmptyRes);
  assert.equal(polishEmptyRes.statusCode, 400);
  assert.equal(jsonBody(polishEmptyRes).error.code, 'empty');

  // 5. /polish oversized body returns 413
  const polishOverReq = mockOversizedReq('POST', 1024 * 1024 + 100);
  polishOverReq.fire();
  const polishOverRes = mockRes();
  await routes['/dsh-voice/polish'](polishOverReq, polishOverRes);
  assert.equal(polishOverRes.statusCode, 413);
  assert.equal(jsonBody(polishOverRes).error.code, 'too-large');

  // 6. /transcribe method guard: non-POST returns 405
  const transGetReq = mockReq('GET');
  const transGetRes = mockRes();
  await routes['/dsh-voice/transcribe'](transGetReq, transGetRes);
  assert.equal(transGetRes.statusCode, 405);
  assert.equal(jsonBody(transGetRes).error.code, 'method');

  // 7. /transcribe untrusted caller returns 403
  const transCrossReq = mockReq('POST', JSON.stringify({ dataBase64: 'AAAA' }), {
    'sec-fetch-site': 'cross-site',
    'origin': 'https://evil.org',
    'host': '127.0.0.1:3000',
  });
  transCrossReq.socket = { remoteAddress: '198.51.100.1' };
  transCrossReq.fire();
  const transCrossRes = mockRes();
  await routes['/dsh-voice/transcribe'](transCrossReq, transCrossRes);
  assert.equal(transCrossRes.statusCode, 403);

  // 8. /transcribe missing audio returns 400
  const transNoAudioReq = mockReq('POST', JSON.stringify({}));
  transNoAudioReq.fire();
  const transNoAudioRes = mockRes();
  await routes['/dsh-voice/transcribe'](transNoAudioReq, transNoAudioRes);
  assert.equal(transNoAudioRes.statusCode, 400);
  assert.equal(jsonBody(transNoAudioRes).error.code, 'no-audio');
});
