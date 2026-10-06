# AGENTS.md — @goodandready/dsh-voice

Project-specific rules only. Root `/mnt/external/Project/DEV/AGENTS.md` still applies.

## Identity
- Package name: `@goodandready/dsh-voice` (must match `package.json`, `cordis.patch.yml` `name:`, client `id: '@goodandready/dsh-voice'`, and server `export const name = '@goodandready/dsh-voice'`)
- Gitea: `goodandready/dsh-voice`
- Agent git wrapper: `git-<agent>` on MiniAI (`/home/vadim/.ssh/bin/git-antigravity`); never bare `git` for commit/push

## Layout & Worktrees
- Root checkout is read-only. All modifications happen strictly in `.worktrees/<branch>`
- Single DEV folder + single production profile (`dsh-web.service` on MiniAI)
- Client bundle: `lib/client.js` must remain self-contained (DSH ModuleLoader serves one browser bundle without in-browser bundler)
- Client fragments: edit `lib/client-src/*.js` and run `node scripts/build-client.mjs` (never edit `lib/client.js` directly)

## Commands
```bash
npm test
# Equivalent to: node scripts/build-client.mjs && node scripts/lint.mjs && node scripts/pack-check.mjs && node --test test/*.test.mjs
```
- Tests must execute locally without DSH harness and without external network connectivity
- Zero failures permitted in automated test suites

## Security & Architectural Constraints
- Loopback and LAN isolation: all mutating POST/PUT routes and private endpoints require validation via `isTrustedCaller` or `isTrustedUpdateRequest` (strict same-origin, loopback/private LAN verification)
- No wildcard CORS: `Access-Control-Allow-Origin: *` is strictly forbidden
- Zero empty catches: all `catch` blocks in `lib/` must either log or contain explicit intention comments (`/* ignore */`, `/* intentional */`)
- Zero Cyrillic: `lib/*.js` must not contain Cyrillic characters except functional linguistic processing tokens in `lib/normalize.js` (voice triggers, stop-words, numerals) documented in `docs/design/DESIGN.md` Section 13
- Line limits: `lib/index.js` must remain < 300 lines; all other files < 600 lines
- Packaging budget: all files in package must remain under 262144 bytes (`pack-check`)

## Publication Safety (MUST NOT)
- `AGENTS.md`, `index.md`, and `deploy.sh` are internal project documentation and MUST NEVER be published to npm or mirrored to public GitHub
- Exclusion is guaranteed by `package.json` `files` allowlist (`lib/`, `cordis.patch.yml`, `README.md`, `LICENSE`, `CHANGELOG.md`) and `scripts/publish-github.sh` filter
- Do not use force flags (`--force`, `git push -f`, `npm publish --force`) under any circumstances
