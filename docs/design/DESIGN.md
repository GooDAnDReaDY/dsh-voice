# DESIGN.md — @goodandready/dsh-voice

## Product / Purpose
- Purpose: voice input for DeepSeek Harness — dictation and voice messages with multi-provider STT fallback chains.
- Audience: DSH users who dictate into the composer or send voice notes without leaving the harness UI.
- Status: active plugin, public package identity `@goodandready/dsh-voice`.

## User Surfaces
- Web/UI:
  - Composer buttons (`conversation.input.right`): mic (dictation), wave (voice message), play last note.
  - Recording pill (`conversation.input.dock`): cancel, visualizer/caption, stop, pending send countdown, error.
  - Settings card (`settings.plugin.item`, key `dsh-voice`): chains, custom providers, general options, SenseVoice, provider health dashboard.
- DSH UI / settings / slots:
  - `conversation.input.right` (composer action buttons: mic, voice message, play note)
  - `conversation.input.dock` (recording pill with waveform visualizer)
  - `plugins.item` (dedicated plugin page view in Plugins manager)
  - `plugins.row.config` (plugin row configuration expandable seat)
  - `settings.plugin.item` (legacy settings panel fallback, key `dsh-voice`)
- API (host):
  - `GET /dsh-voice/status` (live daemon status, running engines, active providers)
  - `POST /dsh-voice/transcribe` (audio chunk transcription with fallback chain)
  - `POST /dsh-voice/polish` (LLM-based transcript punctuation and cleanup)
  - `GET /dsh-voice/config`, `PUT /dsh-voice/config`, `POST /dsh-voice/config` (network configuration persistence)
  - `GET /dsh-voice/sensevoice-installer`, `POST /dsh-voice/sensevoice-installer` (1-click model download and health polling)
  - `GET /api/dsh-voice/update`, `POST /api/dsh-voice/update` (1-click self-updater)
- Agent Tools:
  - `transcribe_audio` (transcribes local audio files for AI agents with format validation and path confinement)
- CLI: none.
- Documentation: `README.md` (EN), `README.ru.md`, `README.zh.md`; this DESIGN.md.

## Visual Direction
- Atmosphere: native DSH chrome — recording pill and settings card match core density, not a standalone brand site.
- References: core settings cards (Console, Agent loop) for 12px radius, 14×16 header padding, 15px/600 title.
- Do not copy foreign product branding or non-DSH layout systems.

## Foundations
- Colors and roles: only DSH theme tokens (`--dsw-alias-*`). Canvas accent comes from `--dsw-alias-state-info-primary` / `--dsw-alias-label-primary`, with `voice.waveColor` as fallback.
- Typography: inherit DSH; settings title 15px/600, secondary 13px, dashboard meta 11–12px.
- Grid / spacing: settings card body `margin: 0 16px`; field gap 6px; page max-width 720px.
- Accessibility: settings header is a `<button>` with `aria-expanded`; hotkey picker uses real key events; error text is not color-only (icon + text).

## Components And States
- Components: `VoiceButtons`, `RecordPill`, `PluginCard`, `VoiceSection`, `ChainEditor`, `CustomEditor`, `ConnectionStatusCard`, `HardwareOptionsCard`, `SensevoiceSection`, `JargonEditor`, `ProviderDashboard`, `UpdaterCard`, visualizers (liquid-wave, dynamic-orb, bars, off).
- Loading: settings snapshot `status === 'loading'` shows loading copy; composer reloads status async.
- Empty / not ready: `unavailable` shows explanatory wait copy and polls `describe().load()`.
- Success: saved toast `Saved ✓`; transcript appended to draft; message mode enters pending countdown.
- Error: pill error row with warning icon; settings save lists failed fields by name.
- Disabled: fields `disabled` when `writable === false`.
- Destructive: cancel recording / discard pending via explicit X; no silent data loss of draft text on cancel.

## User Flows
- Dictation: mic → browser leg if chain[0]==='browser' else MediaRecorder → VAD cut → POST transcribe → optional polish → append draft → optional undo window.
- Voice message: hold/click/hotkey → record → stop → transcribe → pending window → auto-send or keep.
- Session commands: clean send/cancel/stop/continue recognized on host, never inserted as text.
- First run: empty chains still work with defaults; local whisper only starts when `whisperModel` is set.

## Do / Don't
- Do: English locale source; translation plugin supplies other languages; `data-dsh-plugin` on style tags; resolve UI strings via `t()` at render time.
- Don't: hardcode theme hex colors; register a full inline `ru` dictionary; put secrets in settings (credential *names* only).

## Locked Design Decisions
- 2026-09-25 — Route security policy hardening (#117): Same-site requests are strictly rejected (isTrustedCaller), requiring exact same-origin or loopback callers.
- 2026-09-25 — SenseVoice status route protection and path redaction (#153): `/dsh-voice/sensevoice-installer` guards both GET and POST with `isTrustedCaller`, and all returned model/token paths are redacted (no absolute system paths leaked).
- 2026-09-25 — Audio tool path boundary and content verification (#152): `transcribe_audio` tool enforces lexical root boundary check before stat/read, validates realpath to prevent symlink traversal escapes, and verifies audio magic bytes independently of file extension.
- 2026-09-25 — Localized jargon editor placeholder (#151): Jargon placeholder example is localized via locale dictionaries (`en`, `zh`) instead of hardcoded strings.
- 2026-09-25 — Source tree release hygiene (#154): Release artifacts (`*.tgz`) and worktree directories (`.worktrees/`) are excluded via `.gitignore`, and `npm run pack:check` blocks if tarballs exist in the source root.
- 2026-09-09 — settings stay a plugin card (`settings.plugin.item`), not a sidebar section; reason: flat sidebar is a shared scarce resource.
- 2026-09-09 — Changed in v0.8.19: inline `ru` locale dictionary removed; English is the only source dictionary. Users who want Russian UI must install the translation plugin. Reason: authoring contract and drift control. Condition to revisit: product decision to re-bundle locales per plugin.
- 2026-09-09 — Changed in v0.8.19: visualizer paints from DSH theme tokens (no hardcoded hex accents). Reason: light/dark correctness.
- 2026-09-09 — Changed in v0.8.19: style tags use `data-dsh-plugin="dsh-voice"`. Reason: survive neighbour-plugin HMR cleanup.
- 2026-09-09 — English is the only inline locale dictionary; Russian and other languages come from the translation plugin; reason: authoring contract, avoid drift.
- 2026-09-09 — visualizer colors read theme tokens at draw time; reason: light/dark correctness.
- 2026-09-09 — client remains a single ModuleLoader entry (`lib/client.js`); optional source fragments may be concatenated by `scripts/build-client.mjs` if introduced; reason: harness loads one client file.
- 2026-09-10 — Changed in v0.8.20: adopt dsh-clinebot unified styling baseline for settings card: .cb-page, .cb-section-card, .cb-badge (with live latency ping), structured panels, and React ErrorBoundary wrapper for robust error containment.
- 2026-09-16 — Package identity consistency (#118): canonical package name `@goodandready/dsh-voice` is declared identically across `package.json`, `cordis.patch.yml`, `lib/index.js`, and `lib/client.js` to ensure proper Cordis service lifecycle and deduplication.
- 2026-09-16 — Route security policy (#117): POST routes (`/dsh-voice/transcribe`, `/dsh-voice/polish`) enforce fail-closed caller verification (`isTrustedCaller`), allowing only loopback (`127.0.0.1`, `::1`) or validated same-origin (`Sec-Fetch-Site: same-origin` or matching Host/Origin). GET `/dsh-voice/status` remains deliberately public for health and state monitoring.
- 2026-09-16 — Linguistic processing data vs UI text boundary (#122): Cyrillic numerals in `lib/normalize.js` (`NUM_WORDS`), technical stop words in `lib/client-src/30-core.js`, and spoken edit triggers are strictly functional language processing data for audio transcription and VAD post-processing. User-facing UI labels, settings descriptions, and status messages remain strictly English and Chinese (`en`, `zh`), while Russian UI localization is supplied exclusively by `dsh-russian-lang`. Code comments throughout `lib/` are maintained in English.
- 2026-09-16 — Public git repository hygiene (#120): internal agent instructions (`AGENTS.md`, `index.md`), planning task tracks (`.planning/`, `docs/plans/`), and internal test documentation (`docs/testing/`) are permanently excluded from git tracking via `.gitignore`.
- 2026-09-16 — Zero hardcoded colors (#123): All badge, button, alert, and pill elevation styles strictly use native `--dsw-alias-*` tokens and CSS `color-mix(in srgb, var(...) X%, transparent)`. Zero `rgba(...)` or hex literals in client styling, guaranteeing proper rendering on both light and dark themes.
- 2026-09-16 — Native UI primitives chevron (#121): Settings plugin card queries `IconChevronDownOutline14` from `@deepseek-ai/dsh-client-ui-primitives` inside protected `try/catch` with 14x14 animated SVG fallback rotating 180deg on expand.
- 2026-09-16 — Recording pill accessibility and focus management (#100): Recording pill is declared as an accessible `role="region" aria-label` landmark with `aria-live="polite"` on the status caption. All buttons have explicit `aria-label`. Canceling, stopping, or closing the pill automatically returns keyboard focus to the composer input (`focusComposer()`).
- 2026-09-16 — STT autostart error reflection (#98): `/dsh-voice/status` exposes `whisperError` and `sensevoiceError`, reporting the last autostart failure reason without throwing or crashing when local STT binaries/models are unconfigured or fail health checks.
- 2026-09-16 — Provider HTTP helper extraction (#102): Shared HTTP response parsing (`safeJson`, `readErrorDetail`) and multipart helpers (`fileName`, `chatAudioFormat`, `isAutoLang`) are extracted into pure `lib/provider-http.js`, eliminating copy-paste drift and ensuring isolated testability.
- 2026-09-16 — One-click plugin updater (#119): Host-side updater `lib/updater.js` is registered at canonical `/api/dsh-voice/update` via `ctx.effect` with cleanup, enforcing loopback and same-origin security on POST installs with `x-dsh-plugin-update: 1`. Settings card renders a dedicated "Plugin Version & Updates" section showing live version comparison and an in-place update trigger.
- 2026-09-16 — Release pack size gate and lint script (#103): Added `npm run pack:check` enforcing the 250 KiB warning and 262144 bytes (256 KiB) hard block limit across all packaged files, and `npm run lint` verifying syntactic integrity (`node --check`) for all scripts and library files.
- 2026-09-16 — Package dependency audit baseline (#104): Package maintains zero direct runtime `dependencies` and zero `devDependencies`. Peer dependencies (`@deepseek-ai/cordis`, `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-credentials`) are audited and monitored for compatibility without unreviewed breaking bumps.
- 2026-09-17 — Settings namespace isolation (#125): Host registers settings scope under canonical short namespace `NS = 'dsh-voice'` (matching client slot key and `~/.dsh/settings.yaml` configuration key), decoupling package identity (`export const name = '@goodandready/dsh-voice'`) from the UI settings registry. Ensures DSH UI `configurablePlugins` list matches and displays the settings card.
- 2026-09-19 — Voice enhancements and 1-Click SenseVoice setup (#129):
  - 1-Click SenseVoice installer (`lib/sensevoice-installer.js`): Automated on-demand download and extraction of SenseVoice-Small ONNX model (`model.int8.onnx`, `tokens.txt`) to `~/.dsh/models/sensevoice` via loopback endpoint `/dsh-voice/sensevoice-installer`.
  - Turn-Taking and Barge-In coordination (`gatedTurnTaking`, `bargeIn`): Gated audio coordination muting the microphone when assistant audio plays (`dsh:tts:start` / `dsh:tts:stop`), with speech-triggered barge-in interruption.
  - Live ghost text preview (`liveInterimPreview`): Semi-transparent live interim recognition preview within the composer recording pill.
  - SVG Silence Ring timer (`autoSendVisualRing`): Circular countdown animation in the recording dock during pending auto-send state.
  - Hands-free voice actions (`voiceActions`): Voice-triggered commands ("send", "cancel", "clear", "new line") that perform actions directly without being inserted as message text.
  - Spoken interactive choice prompts (`structuredPromptVoice`): Spoken answers automatically matching and submitting buttons in active structured prompts.
  - Developer lexicon correction (`techJargonCorrection`, `jargonDictionary`): Phonetic slang normalization (GitHub, Docker, Kubernetes, pnpm, etc.) with customizable user dictionary in the settings card.
  - Granular control: All 10 features have dedicated toggle switches in the Settings Card, strictly styled with `--dsw-alias-*` tokens and zero hardcoded colors.


- 2026-09-25 — Batch audit hardening and reliability polish:
  - Voice action forwarding (#156): sendAudio in lib/client-src/30-core.js preserves and returns action: parsed.action || null, enabling hands-free voice commands (send, cancel, clear, newline) in the recording loop.
  - Jargon dictionary input state (#157): Decoupled raw textarea editing from parsed dictionary state with [jargonInput, setJargonInput], preventing keystroke clearing while typing.
  - SenseVoice mandatory tokens flag (#158): Wired findTokensFile into startSensevoice in lib/index.js, supplying --tokens to sherpa-onnx-offline-http-server.
  - SenseVoice model archive cleanup (#159): startSensevoiceInstall in lib/sensevoice-installer.js unlinks sensevoice.tar.bz2 immediately after extraction and on failure, saving ~150 MB disk space.
  - Status fetch recovery (#160): Reset chainsPromise = null on error in modeChain(), preventing temporary network failures from permanently disabling speech recording.
  - Lifecycle tool disposal (#161): Wrapped ctx.tools.register(transcribe_audio) in ctx.effect, guaranteeing clean unregistration on hot reload.
  - Code deduplication (#162): Replaced duplicate isAutoLang definition in lib/index.js with shared import from ./provider-http.js.
  - Multilingual voice commands (#163): Added Chinese command matching to extractVoiceActions (发送, 取消, 清空, 换行) and submitToStructuredPrompt (是, 好, 确认, 同意, 不, 否, 取消).
  - Client build parity check (#164): Added scripts/build-client.mjs --check, npm run build:check, and test/build-parity.test.mjs.

- 2026-09-28 — Hotkey lifecycle singleton and multi-key combinations (#171):
  - Global listener cleanup (`clearGlobalHotkey`): Global singleton tracking (`window.__dsh_voice_hotkey_cleanup` and module-scoped `activeHotkeyCleanup`) enforces teardown of all previous `keydown`/`keyup`/`blur` listeners on hotkey rebind, plugin reload, or component unmount.
  - Multi-key combinations & function keys: `keyFromEvent` and `hotkeyMatches` support compound combinations (`Control+Space`, `Alt+KeyV`) and function keys (`F1`-`F24`). `keyLabel` formats compound keys into readable strings (`Ctrl + Space`, `Alt + V`).
  - Composer input focus tolerance (`isAllowedInEditable`): Prevents non-character hotkeys (modifiers, combos, F-keys, Tab, Insert) from being discarded while typing in editable elements (`TEXTAREA`/`INPUT`), accompanied by explicit `event.preventDefault()` and `event.stopPropagation()` to avoid cursor displacement.
  - Immediate reactive binding: Selecting a new hotkey or clearing in the Settings card applies immediately to the active client runtime (`voice.hotkey`) and attaches the new listener without requiring a full page refresh.

- 2026-09-28 — Route security hardening, base64 payload limits, public auto language, and safe updater (#173, #174, #175, #176):
  - Cross-site loopback caller mitigation (#173): Reordered security evaluation in `isTrustedCaller` (`lib/http-util.js`) to reject `Sec-Fetch-Site: cross-site | same-site` and validate `Origin`/`Referer` against `Host` *before* checking socket loopback address. Added mandatory `Content-Type: application/json` or `octet-stream` check for mutating requests (POST/PUT/PATCH), blocking simple cross-site form POST attacks behind reverse proxies.
  - Base64 payload expansion and 413 error reporting (#174): In `/dsh-voice/transcribe`, expanded request body read limit to `Math.ceil((maxFileBytes * 4) / 3) + 64 KiB` to account for base64 overhead on files up to 25 MiB. Handled stream limit aborts with HTTP 413 `too-large` and descriptive message instead of generic 400.
  - Public default language decoupling and conditional normalization (#175): Changed default recognition language in `BaseConfig` from hardcoded `'ru'` to `''` (auto-detection), delegating language selection to provider autodetection for international users. In `lib/normalize.js`, gated Russian spoken number conversion (`wordsToDigits`) and default tech slang dictionary behind language inspection (`isRussianLang`), applying them only when language is Russian or when text contains Cyrillic characters.
  - Safe updater execution and profile lock lifecycle (#176): In `lib/updater.js`, removed `--config.minimumReleaseAge=0` to preserve pnpm supply-chain protections. Introduced `checkProfileLock`, checking whether `package.json.lock` belongs to an active PID via `process.kill(pid, 0)`: returns HTTP 409 conflict when another install is in progress, and cleans up abandoned stale locks on timeout or process exit.

- 2026-09-28 — Deep audit resolutions for client security headers, auto language preservation, modular architecture, and daemon respawn (#178, #179, #180, #181):
  - Client-side Content-Type on mutation routes (#178): In lib/client-src/72-voice-section.js, triggerInstallSensevoice explicitly sets Content-Type: application/json on POST /dsh-voice/sensevoice-installer. This satisfies rule 4 in isTrustedCaller (lib/http-util.js) and unblocks 1-click SenseVoice installation in the settings card.
  - Auto-language preservation in modeChain (#179): In lib/client-src/40-recording.js, replaced row.language || 'ru' with row.language !== undefined ? row.language : ''. This ensures that configuring language to auto ("", introduced in #175) does not get clobbered to Russian, correctly preserving browser recognition and STT language hints for English and Chinese speech.
  - Modular architecture decomposition (#180): Refactored monolithic lib/index.js (reduced from 693 to 502 lines, well under the 600-line modularity threshold) by decomposing Schemastery schemas (ChainEntry, CustomProvider, BaseConfig) into lib/schema.js and the transcribe_audio tool registration and MIME mappings into lib/tool.js.
  - Process lifecycle termination on respawn (#181): In lib/index.js (startWhisper, startSensevoice), added explicit termination checks (if (child && typeof child.kill === 'function') { child.kill(); child = null }) before spawning a new process via ctx.shell.start(), preventing orphaned zombie processes and port contention (EADDRINUSE).


- 2026-10-02 — WebGPU/WASM Whisper in browser and SBC NPU host acceleration (#168):
  - Client-side offline WebGPU Whisper (`browser-webgpu`): Added provider key `browser-webgpu` in `lib/providers.js` and `lib/client-src/35-webgpu.js`. Checks `navigator.gpu` presence and executes in-browser transcription using compact quantized Whisper models without sending audio over the network.
  - Transparent graceful fallback: When WebGPU is not supported or initialization fails, `sendAudio` automatically falls through to the host fallback chain (/dsh-voice/transcribe) without interrupting user recording.
  - Local engine compatibility: `buildProviderOrder` in `lib/transcribe-core.js` includes `browser-webgpu` in `localEngines`, allowing fully offline operation under `localOnly: true`.
  - SBC NPU & multi-thread acceleration: Added `sensevoiceProvider` (options: `cpu`, `rknpu` for Rockchip RK3588 NPU, `openvino`, `cuda`) and `sensevoiceThreads` in `lib/schema.js` and `buildSensevoiceArgs` in `lib/sensevoice-installer.js` to run sherpa-onnx directly on ARM SBC NPUs.
