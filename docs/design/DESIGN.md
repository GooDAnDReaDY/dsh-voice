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

