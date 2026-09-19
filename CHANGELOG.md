# Changelog

Notable changes to `@goodandready/dsh-voice`.

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
