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
- `lib/audio-guard.js` — Audio size limits, MIME type validation, and secure root confinement
- `lib/best-effort.js` — Safe non-critical side effects and logging wrapper (#332, #345)
- `lib/chain.js` — Sequential provider fallback chain execution with telemetry tracking
- `lib/client.js` — Compiled browser bundle loaded via `window.__ModuleLoader__.load()`
- `lib/config-compat.js` — Backward-compatible configuration reader and schema adapters
- `lib/config-routes.js` — Host route `/dsh-voice/config` for network persistence and revision guards
- `lib/dictation-modes.js` — Post-processing dictation modes (verbatim, clean, task, note, bug) (#264, #346)
- `lib/errors.js` — Structured voice error classes and normalized error payloads
- `lib/host-routes.js` — Status (`/dsh-voice/status`), provider health, and VAD endpoints
- `lib/http-util.js` — HTTP helpers, `isTrustedCaller` origin validation, and token signing
- `lib/index.js` — Cordis plugin entrypoint (`apply`, schema, lifecycle, tools)
- `lib/local-daemon.js` — Background lifecycle management for `whisper-server` and `sherpa-onnx`
- `lib/macros.js` — Voice macro execution and text templating
- `lib/normalize.js` — Number, currency, and punctuation spoken-word text normalizer
- `lib/polish.js` — LLM text cleanup and punctuation post-processing
- `lib/provider-http.js` — HTTP adapters for OpenAI, Deepgram, Groq, and custom STT APIs
- `lib/provider-registry.js` — STT provider strategy pattern, validation, and registry (#306, #347)
- `lib/providers.js` — Built-in provider definitions, models, and default registry instance
- `lib/schema.js` — Schemastery runtime configuration schema and default settings
- `lib/sensevoice-installer.js` — SenseVoice 1-click downloader, extractor, and provider resolver
- `lib/server-daemons.js` — Server daemon process supervisor integration (#304)
- `lib/server-routes.js` — Subsystem route registration and lifecycle bindings (#304)
- `lib/server-tools.js` — Transcription pipeline, secret resolver, and `transcribe_audio` tool
- `lib/stats.js` — In-memory rolling latency and reliability metrics per provider
- `lib/supervisor.js` — Process supervisor and finite state machine (#310)
- `lib/tool.js` — Agent tool `transcribe_audio` definition and argument schema
- `lib/transcribe-core.js` — Provider ordering, model overrides, and localOnly filtering
- `lib/updater.js` — In-app plugin updater (`/api/dsh-voice/update`) with profile lock checks
- `lib/wav.js` — In-memory 16kHz mono WAV encoding and `ffmpeg` transcode helper
- `lib/ws-framer.js` — RFC 6455 WebSocket frame parser, mask unmasking, and ping/pong

### Modular Client Architecture (`lib/client-src/`)
37 modular ES fragments bundled via `npm run build:client` into `lib/client.js`:
- `00-open.js` ... `20-css.js` ... `30-core.js` ... `40-recording.js` ... `60-composer.js` ... `70-settings-*.js` ... `90-close.js`

## Commands
```bash
npm test                 # Run all automated unit tests
npm run build:client     # Rebuild lib/client.js from lib/client-src fragments
npm run build:check      # Verify lib/client.js matches compiled client-src bundle
npm run lint             # Check syntax across all source files
npm run pack:check       # Verify file size budget (< 256 KiB) and packaging cleanliness
npm run pretest          # Run build, lint, and pack checks before tests
```
