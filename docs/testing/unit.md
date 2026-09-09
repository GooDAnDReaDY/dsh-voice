# Unit tests

Run from the repository root:

```bash
npm test
```

This executes `node --test test/*.test.mjs` and covers:
- `runChain` fallback / errors / stats callbacks
- provider request construction and refusal paths (mocked fetch)
- SenseVoice tag stripping and OpenAI-compatible mode
- transcript normalize helpers
- stats tracker and vocabulary merge

Browser client paths are not covered by unit tests; verify visually on the DSH test server before release.
