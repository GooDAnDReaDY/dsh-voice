# Unit tests

Run from the repository root:

```bash
npm test
```

This rebuilds the browser client (`pretest` → `scripts/build-client.mjs`) and executes `node --test test/*.test.mjs`, covering:
- `runChain` fallback / errors / stats callbacks
- provider request construction and refusal paths (mocked fetch)
- SenseVoice tag stripping and OpenAI-compatible mode
- transcript normalize helpers
- stats tracker and vocabulary merge

To rebuild only the client without tests:

```bash
npm run build:client
```

Browser client UI paths are not covered by unit tests. Verify on the DSH test server before release:
- settings card placeholders (model/path hints resolve via locale at render time)
- visualizer on light and dark themes
- style tags keep `data-dsh-plugin="dsh-voice"` after reload
- English UI without the translation plugin
