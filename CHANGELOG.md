# Changelog

Notable changes to `@goodandready/dsh-voice`.

## 0.9.0

### Added
- **Host settings persistence route (`/dsh-voice/config`).** Added dedicated host route for reading (`GET`) and updating (`PUT`/`POST`) plugin configuration directly on the server, solving DSH network limitations where client-side settings persistence is blocked in non-loopback environments (Gitea #149).
- **Security & validation for config routes.** Implemented fail-closed caller verification (`isTrustedCaller`), allowed HTTP method enforcement, 503 handling when settings service is unavailable, and full schema validation against `BaseConfig`.

### Changed
- **Client settings card (`VoiceSection`) network-ready.** Fetches `/dsh-voice/config` on mount to render and populate settings even when kernel `configForms` reports `unavailable` or `writable: false` over the network. Saves directly via HTTP `PUT /dsh-voice/config` with clear error toasts on failure and loopback `scope.set` best-effort sync.

### Fixed
- **Hotkey typing collision guard.** In `installHotkey`, non-modifier hotkeys (such as letter keys) no longer trigger voice recording when typing inside text inputs, textareas, or `contenteditable` elements.

## 0.8.38

### Fixed
- **whisper-server & SenseVoice autostart on deferred settings loading.** Autostart is wired to trigger once Cordis `settings` service finishes deferred initialization, on `scope.watch()` settings updates, and on `loader/volatile-update`, `settings/document-updated`, and `config` events (GooDAnDReaDY/dsh-voice#8, Gitea #147).
- **Extended autostart healthcheck timeout.** Increased healthcheck timeout from 10s to 30s to reliably support cold model loading on Apple Silicon (Metal) and CPU.
- **Premature child process exit detection.** Added immediate exit code check so failed binary launches fail fast with a descriptive error instead of waiting for the full timeout.

## 0.8.37

### Fixed
- **Settings form appears on DSH 0.1.7-rc.1.** Config fields are declared with `.volatile()` so `@deepseek-ai/dsh-settings` recognizes the plugin's editable configuration schema and announces the `dsh-voice` namespace to client forms (GooDAnDReaDY/dsh-voice#7, Gitea #145).
- **Volatile configuration decoding.** `createConfigReader` unwraps volatile `.get()` nodes on modern DSH cores while caching resolved values across requests.
- **Client slot cleanup.** Removed dead `settings.plugin.item` registration while preserving `plugins.item` and `plugins.row.config`.

## 0.8.36

### Fixed
- Settings no longer wait on the removed settingsScope service. The client uses configForms (#143).

## 0.8.35

### Fixed
- **Windows: hide console windows for spawned processes.** Pass `{ windowsHide: true }` to `ffmpeg` audio conversion in `lib/wav.js` and `tar` archive extraction in `lib/sensevoice-installer.js`. On Windows under Electron (DSH Desktop GUI), this prevents the brief black console window (`conhost.exe`) flash when invoking child processes (GooDAnDReaDY/dsh-voice#6, Gitea #141).

## 0.8.34

### Fixed
- **localOnly accepts SenseVoice.** A chain that uses only the local SenseVoice engine no longer fails closed with a whisper-only error.
- **SenseVoice installer lifecycle.** The download waits for disk backpressure and closes the file if the transfer fails. Reloading the plugin removes the installer route.
- **Health checks no longer leave timers behind** when whisper.cpp or SenseVoice is down.
- **Jargon replacements reuse compiled expressions** instead of building a new RegExp for every phrase.
- **Docs no longer advertise `/dsh-voice/realtime`.** That WebSocket route is not implemented.
- **GitHub mirror keeps `lib/*.js`.** The publication allowlist expands npm `files` globs, so the plugin sources are part of the sanitized tree.

## 0.8.33

### Fixed
- **Settings reachable again on the plugin's own page**: the current DSH core
  (0.1.6-alpha.2) renders a plugin's configuration page only for entries registered
  in the plugin-list seat `plugins.item` — that is how `dsh-agentrouter` and
  `dsh-agent-orchestrator` show their settings, while the row seat and the legacy
  card alone leave the page without the form. The view-aware `PluginCard` is now
  registered there too (`id: 'dsh-voice'`, order 60, static label); the row seat and
  `settings.plugin.item` stay as fallbacks. The change lives in
  `lib/client-src/73-plugin-card.js` and `lib/client.js` was rebuilt.

## 0.8.32

### Added
- **1-Click SenseVoice-Small Installer**: On-demand download and unpacking of the ultra-fast local SenseVoice-Small ONNX model (`model.int8.onnx`, `tokens.txt`) to `~/.dsh/models/sensevoice` via loopback endpoint `/dsh-voice/sensevoice-installer`.
- **Gated Turn-Taking & Echo Prevention**: Automatically mutes the microphone input when the assistant is speaking (`dsh:tts:start` and `dsh:tts:stop`), avoiding acoustic echo and feedback into transcripts.
- **Barge-In Speech Interruption**: True voice barge-in support allowing immediate interruption of ongoing assistant speech when the user begins talking.
- **Live Ghost Text Interim Preview**: Dynamic interim transcript preview inside the recording pill before the final sentence chunk is finalized.
- **SVG Silence Ring Timer**: Visual circular SVG timer animation in the composer dock during the pending auto-send delay.
- **Hands-free Voice Action Commands**: Voice-triggered control commands ("send", "cancel", "clear", "new line") executing directly without cluttering draft text.
- **Interactive Structured Prompt Voice Answers**: Spoken phrases can automatically select and trigger options in active modal question prompts.
- **Developer Lexicon & IT Jargon Correction**: Phonetic auto-correction of programming slang and technical terms (GitHub, Docker, Kubernetes, pnpm, etc.) with customizable dictionary editing in Settings.
- **Individual Toggle Switches**: Every enhancement feature can be independently toggled on or off directly in the Settings Card.

## 0.8.31

### Fixed
- **The plugin no longer breaks the whole client layer**: the two composer
  registrations (`conversation.input.right`, `conversation.input.dock`) declared
  `label` but no `locale`, so the core resolved the label through an empty inject
  face and threw `cannot get property "t" without inject` while building the slot
  snapshot. That exception aborted the client batch, which is why the Settings
  sections and every plugin settings card disappeared. Both entries now declare
  `locale: NS`.
- **Settings reachable again**: the settings card registered into
  `settings.plugin.item`, a slot the current DSH core (0.1.6-alpha.2) no longer
  renders. The surface now registers into the Plugins page row seat
  `plugins.row.config` first, keyed `@goodandready/dsh-voice#dsh-voice`
  (`rowConfigKey(package, rowId)`): the plugin's row gains a configure control whose
  page is the settings form (`view: 'page'`, open and without our card chrome) plus
  a one-line state for `view: 'summary'`. The legacy seat stays as a fallback.

### Added
- This changelog.
