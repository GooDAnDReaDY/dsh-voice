# Фактический план: #107 M: fix recording pill stop button overflow by adding min-width:0 to canvas (#4)

## Ветка и Worktree
- Worktree: `/mnt/external/Project/DEV/dhsplugins/dsh-voice/.worktrees/pill-canvas-overflow`
- Branch: `fix/pill-canvas-overflow`
- Целевая версия: `0.8.24`

## Проблема (GitHub #4)
В `lib/client-src/60-composer.js` компонент `RecordPill` рендерит `<canvas className="dvo-wave" width="720" height="40">`.
В `lib/client-src/20-css.js` класс `.dvo-wave` имеет `flex:1;height:40px;width:100%`.
Из-за специфики CSS Flexbox: для flex-элементов `min-width` по умолчанию равен `auto`. При отсутствии явного `min-width` и наличии canvas с внутренними размерами (intrinsic size 720px), flexbox использует 720px как минимальный размер, так как `width: 100%` является относительным (percentage-based).
В итоге вся строка pill (720px холст + кнопки + отступы) превышает ширину родительского контейнера или max-width pill (720px), и правая кнопка «Стоп» выталкивается за скруглённую границу pill.

## Решение
1. [ ] Обновить `.dvo-wave` в `lib/client-src/20-css.js`:
   Задать `min-width:0;max-width:100%;` чтобы flexbox мог сжимать canvas до доступной ширины контейнера.
2. [ ] Пересобрать клиентский бандл `lib/client.js` через `npm run pretest`.
3. [ ] Добавить регрессионный тест в `test/routes.test.mjs`, проверяющий наличие `min-width:0` у `.dvo-wave`.
4. [ ] Прогнать весь тестовый набор `npm test`.
5. [ ] Поднять версию до `0.8.24` в `package.json`.
6. [ ] Закоммитить через `git-antigravity`, отправить ветку, открыть PR #108 и слить в `main`.
7. [ ] Закрыть Issue #107 и подготовить релиз.
