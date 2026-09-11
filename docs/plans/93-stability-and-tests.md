# План реализации #93: Стабильность парсеров URL, ошибок HTTP, инвалидация кэша цепочек и тесты

- **Ветка**: `feat/stability-and-tests`
- **Worktree**: `.worktrees/stability-and-tests`
- **Gitea Issue**: #93

## Шаги
1. **Безопасный URL-парсинг в `lib/index.js`**:
   - `whisperAlive()`: корректно извлекать базовый URL без жесткого `split('/inference')[0] + '/'`.
   - `startSensevoice()`: оборачивать `new URL(cfg.sensevoiceUrl)` в `try/catch` с дефолтным портом 6006.
   - `transcribe_audio`: безопасный fallback для описания языка при undefined `baseConfig.message`.
2. **Детализация HTTP-ошибок в `lib/providers.js`**:
   - Добавить хелпер `readErrorDetail(res, defaultLabel)` для Deepgram, Groq, HF, чтобы в reason цепочки попадало точное сообщение сервера (например, "Groq: invalid_api_key"), а не только код статуса.
3. **Инвалидация браузерного кэша `chainsPromise` в `lib/client-src/40-recording.js`**:
   - Сбрасывать `chainsPromise = null` при событии `dsh-voice:settings-saved`, чтобы при смене цепочки в настройках не требовалась перезагрузка страницы.
   - Пересобрать клиентский бандл `lib/client.js` через `npm run pretest`.
4. **Тесты**:
   - Добавить `test/wav.test.mjs` для тестирования `toWav16k` (включая обработку ошибок ffmpeg).
   - Добавить `test/tools.test.mjs` для тестирования логики `transcribe_audio` (валидация файлов, ошибки, нормализация) и хелперов URL.
5. **Проверка и публикация**:
   - `npm test`
   - Bump версии до `0.8.21` в `package.json`
   - PR, merge, deploy.
