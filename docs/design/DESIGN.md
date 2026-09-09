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
- DSH UI / settings / slots: `conversation.input.right`, `conversation.input.dock`, `settings.plugin.item`; settings namespace `dsh-voice`.
- API (host):
  - `GET /dsh-voice/status`
  - `POST /dsh-voice/transcribe`
  - `POST /dsh-voice/polish`
- CLI: none.
- Documentation: `README.md` (EN), `README.ru.md`, `README.zh.md`; this DESIGN.md; `index.md`.

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
- Components: `VoiceButtons`, `RecordPill`, `PluginCard`, `VoiceSection`, `ChainEditor`, `CustomEditor`, provider dashboard tiles, visualizers (liquid-wave, dynamic-orb, bars, off).
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
- 2026-09-09 — settings stay a plugin card (`settings.plugin.item`), not a sidebar section; reason: flat sidebar is a shared scarce resource.
- 2026-09-09 — Changed in v0.8.19: inline `ru` locale dictionary removed; English is the only source dictionary. Users who want Russian UI must install the translation plugin. Reason: authoring contract and drift control. Condition to revisit: product decision to re-bundle locales per plugin.
- 2026-09-09 — Changed in v0.8.19: visualizer paints from DSH theme tokens (no hardcoded hex accents). Reason: light/dark correctness.
- 2026-09-09 — Changed in v0.8.19: style tags use `data-dsh-plugin="dsh-voice"`. Reason: survive neighbour-plugin HMR cleanup.
- 2026-09-09 — English is the only inline locale dictionary; Russian and other languages come from the translation plugin; reason: authoring contract, avoid drift.
- 2026-09-09 — visualizer colors read theme tokens at draw time; reason: light/dark correctness.
- 2026-09-09 — client remains a single ModuleLoader entry (`lib/client.js`); optional source fragments may be concatenated by `scripts/build-client.mjs` if introduced; reason: harness loads one client file.
