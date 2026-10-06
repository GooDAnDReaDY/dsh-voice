# dsh-voice

Current release line: **0.9.x** (voice input with pause chunking, fallback chains, SenseVoice, and offline Whisper).

## Purpose
Voice input for DeepSeek Harness (DSH):
- Continuous dictation with automatic speech pause chunking and configurable silence VAD.
- Voice message recording with instant audio level visualization.
- Multi-tier fallback provider chains: Deepgram, Groq, HuggingFace, local whisper.cpp, custom OpenAI-compatible endpoints.
- SenseVoice 1-click installer and local HTTP inference daemon (`sherpa-onnx`).
- In-browser WebGPU and WebAssembly offline Whisper transcription (`@huggingface/transformers`).
- Real-time technical jargon correction and context keyword boosting.

## Status
- Package: `@goodandready/dsh-voice`
- Version: see `package.json`
- Verified: `npm test` (all unit test suites pass, 0 fail)

## Paths
- DEV root: `/mnt/external/Project/DEV/dhsplugins/dsh-voice`
- Worktrees: `.worktrees/<branch>` only; DEV root checkout is read-only
- Gitea: `goodandready/dsh-voice` (internal source of truth)
- GitHub: `GooDAnDReaDY/dsh-voice` (sanitized public product mirror only)
- Production service: `dsh-web.service` on MiniAI (`192.168.1.111`), port 3080

## Entry Points
- Server entry: `lib/index.js` (Cordis plugin `apply`, settings schema, route registration)
- Client entry: `lib/client.js` (Browser bundle for DSH `window.__ModuleLoader__.load()`)
- Bundle patch: `cordis.patch.yml`

## Modules
- `lib/audio-guard.js` — Audio size limits, MIME type guards, and format validation
- `lib/chain.js` — Sequential provider fallback chain execution with telemetry
- `lib/config-compat.js` — Migration helpers for legacy plugin configuration shapes
- `lib/config-routes.js` — REST endpoints for plugin configuration snapshot and mutation
- `lib/host-routes.js` — Status (`/dsh-voice/status`), transcribe, and polish endpoints
- `lib/http-util.js` — HTTP helpers, `isTrustedCaller` origin validation, and JSON wrappers
- `lib/local-daemon.js` — Background lifecycle management for `whisper-server` and `sherpa-onnx`
- `lib/normalize.js` — Number, currency, and punctuation spoken-word text normalizer
- `lib/polish.js` — LLM text cleanup and punctuation post-processing
- `lib/provider-http.js` — HTTP adapters for OpenAI, Deepgram, Groq, and custom STT APIs
- `lib/providers.js` — Provider registry, factory, and built-in defaults
- `lib/schema.js` — Schemastery runtime configuration schema and default settings
- `lib/sensevoice-installer.js` — SenseVoice 1-click downloader, extractor, and provider resolver
- `lib/stats.js` — In-memory rolling latency and reliability metrics per provider
- `lib/tool.js` — Agent tool `transcribe_audio` registration in `ctx.tools`
- `lib/transcribe-core.js` — Provider ordering, model overrides, and localOnly filtering
- `lib/updater.js` — In-app plugin updater (`/api/dsh-voice/update`) with profile lock checks
- `lib/wav.js` — In-memory 16kHz mono WAV encoding and `ffmpeg` transcode helper

## Commands
```bash
npm test                 # Run all automated unit tests
npm run build:client     # Rebuild lib/client.js from lib/client-src fragments
npm run lint             # Check syntax across all source files
npm run pack:check       # Verify file size budget (< 256 KiB) and packaging cleanliness
npm run pretest          # Run build, lint, and pack checks before tests
```
