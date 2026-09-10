# Plan: Unify UI styling with dsh-clinebot baseline and enhance stability & test coverage

## 1. Goal & Requirements
- Align dsh-voice settings UI styling and structure with dsh-clinebot as the design baseline.
- Structure settings into structured .cb-section-card panels with .cb-section-title, .cb-section-desc, .cb-badge, .cb-input, .cb-btn, and an ErrorBoundary.
- Improve stability: resolve dead-code / scoping issues in lib/index.js, add abort timeouts for client requests.
- Add test coverage for untested routes (/dsh-voice/status, /dsh-voice/polish, /dsh-voice/transcribe) and the transcribe_audio tool.
- Ensure 100% clean test passes and strict compliance with gitea-project-workflow.

## 2. Work Breakdown
- [ ] Audit and fix host runtime issues (lib/index.js).
- [ ] Add unit & integration tests for HTTP routes and tool (test/routes.test.mjs, test/tools.test.mjs).
- [ ] Refactor client styles in lib/client-src/20-css.js.
- [ ] Add UI strings in lib/client-src/10-locale.js.
- [ ] Refactor settings in lib/client-src/70-settings.js into card sections with ErrorBoundary and status badges.
- [ ] Rebuild client via npm run pretest and verify npm test.
- [ ] Update docs/design/DESIGN.md with new UI contract details.
