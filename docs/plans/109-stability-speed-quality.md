# Plan: Issue #109 — M: stability, speed, quality and UX improvements (v0.8.25)

## Overview
Comprehensive enhancement of `@goodandready/dsh-voice` focusing on:
1. **Stability**: Fix settings snapshot extraction bug (`snap.*` vs `value.*`) in `VoiceSection`, ensure `audioCtx.resume()` on microphone open, introduce FIFO Promise queue for dictation chunks to prevent out-of-order text insertions.
2. **Speed**: Switch waveform visualizer animation from `setInterval(33)` to `requestAnimationFrame` (60/120 FPS vsync), add HTTP Keep-Alive for cloud provider streams.
3. **Quality**: HiDPI/Retina responsive canvas scaling for waveform visualizer, mobile `touch-action` / `user-select` guards, add unit test suite for client logic (`test/client-logic.test.mjs`).
4. **UX**: Interactive microphone test with volume meter in settings card, hotkey tooltip in composer.

## Component Changes
- `lib/client-src/20-css.js`: Touch and user-select guards, styling for mic tester.
- `lib/client-src/40-recording.js`: `audioCtx.resume()` and sequential Promise queue.
- `lib/client-src/60-composer.js`: `requestAnimationFrame` loop, HiDPI canvas scaling, hotkey hints.
- `lib/client-src/72-voice-section.js`: Fix `snap.*` -> `value.*`, add interactive mic tester.
- `lib/providers.js` & `lib/index.js`: Keep-Alive agent options for cloud provider requests.
- `test/client-logic.test.mjs`: Pure client-logic test coverage (tidyPhrase, applyVoiceCommands, mergeContextVocabulary).
- `test/routes.test.mjs`: Verify new CSS and client bundle build.
