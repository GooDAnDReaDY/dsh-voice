# dsh-voice

Voice input plugin for DeepSeek Harness: dictation and voice messages with provider fallback chains.

## Paths
- DEV: repository root of `@goodandready/dsh-voice`
- Package: `@goodandready/dsh-voice`
- Host entry: `lib/index.js`
- Browser entry (built artifact): `lib/client.js` (`window.__ModuleLoader__.load`)
- Browser source fragments: `lib/client-src/*.js` (edit these, not the built file)
- Client build: `scripts/build-client.mjs` via `npm run build:client` (also `pretest`)
- Bundle patch: `cordis.patch.yml` (`name` must stay the full package name)

## Status
- Version: see `package.json` (`0.8.19` — quality batch release)
- Quality batch: issues #79–#87, PR #88 (settings/visualizer fixes, EN source, client split, docs)

## Test matrix
| Check | Command |
|-------|---------|
| Unit tests | `npm test` (`node --test test/*.test.mjs`; rebuilds client first) |
| Client rebuild only | `npm run build:client` |
| Pack size gate | `npm pack --dry-run` — every file < 250 KiB practical / 262144 B hard |
| Name identity | `package.json` name == `cordis.patch.yml` name == client loader `id` |

## Build / publish
- Browser client source lives in `lib/client-src/*.js` (ordered fragments).
- `npm run build:client` concatenates fragments into `lib/client.js` (single ModuleLoader entry).
- `npm test` rebuilds the client first (`pretest`).
- No external bundler.
- Publish only after test-server cycle, production candidate acceptance, and explicit owner approval (DSH release workflow).

## Docs
- User: `README.md` / `README.ru.md` / `README.zh.md`
- Design contract: `docs/design/DESIGN.md`
- Unit testing: `docs/testing/unit.md`
- This file: project map for agents
