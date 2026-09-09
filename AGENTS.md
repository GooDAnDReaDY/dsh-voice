# AGENTS.md — dsh-voice

Project-specific rules. Root `AGENTS.md` remains the base.

## Scope
DeepSeek Harness plugin: host STT proxy + browser recording/composer UI.

## Constraints (MUST NOT)
- Do not put API keys in settings; store credential *names* only.
- Do not hardcode absolute machine paths or secrets in code/README.
- Do not force-push, `--force` npm/dsh, or bypass tests.
- Do not ship a full inline non-English locale dictionary; English is source language.
- Do not mark style tags with a generic attribute; use `data-dsh-plugin="dsh-voice"`.

## Conventions
- English comments and error strings in `lib/`.
- Spoken command phrase tables may include non-English patterns that match STT output; document them.
- Pure logic (chain, providers, normalize, stats, wav) stays free of cordis/network so `npm test` runs without a harness.
- Client runtime is one ModuleLoader file (`lib/client.js`), built from ordered `lib/client-src/*.js` fragments via `npm run build:client`. Edit fragments, not the built file. Keep UI strings behind locale keys.

## Testing
- `npm test` must pass before PR/merge.
- Provider behaviour is covered by mocked `fetchImpl` in `test/providers.test.mjs` and `test/sensevoice.test.mjs`.

## Release
- Follow DSH plugin release workflow; production only after test-server cycle and explicit owner OK.
- Version bump of `z` only unless the owner asks otherwise.
