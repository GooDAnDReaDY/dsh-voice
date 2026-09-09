# dsh-voice

Voice input plugin for DeepSeek Harness: dictation and voice messages with provider fallback chains.

## Paths
- DEV worktree root: this repository
- Package: `@goodandready/dsh-voice`
- Host entry: `lib/index.js`
- Browser entry: `lib/client.js` (`window.__ModuleLoader__.load`)
- Bundle patch: `cordis.patch.yml` (`name` must stay the full package name)

## Status
- Version: see `package.json` (`0.8.18` at quality-batch base)
- Last quality batch: fixes for issues #79–#87 (see Gitea)

## Test matrix
| Check | Command |
|-------|---------|
| Unit tests | `npm test` (`node --test test/*.test.mjs`) |
| Pack size gate | `npm pack --dry-run` — every file < 250 KiB practical / 262144 B hard |
| Name identity | `package.json` name == `cordis.patch.yml` name == client loader `id` |

## Build / publish
- Browser client source lives in `lib/client-src/*.js` (ordered fragments).
- `npm run build:client` concatenates fragments into `lib/client.js` (single ModuleLoader entry).
- `npm test` rebuilds the client first (`pretest`).
- No external bundler. Publish only after explicit owner approval per release workflow.

## Docs
- User: `README.md` / `README.ru.md` / `README.zh.md`
- Design: `docs/design/DESIGN.md`
- This file: project map for agents
