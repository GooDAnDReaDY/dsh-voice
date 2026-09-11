# Фактический план: #95 M: enhance JSON/stream resilience across STT providers & expand config test suite

## Ветка и Worktree
- Worktree: `/mnt/external/Project/DEV/dhsplugins/dsh-voice/.worktrees/stability-and-resilience`
- Branch: `feat/stability-and-resilience`
- Целевая версия: `0.8.22`

## Задачи
1. [ ] Укрепить чтение JSON в `lib/providers.js`:
   - Добавить безопасный разбор ответов `safeJson(res, label)` во всех провайдерах.
   - Превращать сбои парсинга (HTML от шлюзов, невалидный синтаксис при HTTP 200) в отказ провайдера `{ ok: false, provider, reason }`, чтобы цепочка продолжала работать.
2. [ ] Оптимизировать клон draft в `lib/client-src/70-settings.js`.
3. [ ] Пересобрать `lib/client.js` через `npm run pretest`.
4. [ ] Добавить тест `test/config.test.mjs` на валидацию и дефолты схемы `Config`.
5. [ ] Добавить тесты в `test/providers.test.mjs` на устойчивость к не-JSON ответам.
6. [ ] Запустить полный тест `npm test`.
7. [ ] Обновить версию в `package.json` до `0.8.22`.
8. [ ] Создать коммит через `git-antigravity`, запушить ветку, открыть PR и объединить.
