# Task Plan: #18 settings -> Plugins tab card

Goal: перенести настройки dsh-voice из бокового списка (settings.section)
в карточку вкладки Плагины (settings.plugin.item), с запасным путем на старый
раздел, локализацией и проверками.

Branch: issue-18-plugin-tab-card
Worktree: DEV/dhsplugins/dsh-voice/.worktrees/issue-18-plugin-tab-card

## Phases
### Phase 1: Research (Status: complete)
- Контракт слота: issue #18 + dsh-vision-bridge#44 (тот же переезд, try/catch
  вокруг slots.inject, key=NS) + dshmarket (карточка рисует свой контейнер,
  header+chevron+collapse, ленивая загрузка при раскрытии).
- Ядро даёт только рамку списка; entryKey = пространство настроек (dsh-voice).

### Phase 2: Implement (Status: complete)
- lib/client.js: PluginCard (collapse, заголовок, пояснение) -> VoiceSection;
  registerSettings через settings.plugin.item c key:NS, locale:NS;
  fallback на settings.section при отсутствии слота.
- Локаль: новые строки en/ru для карточки.
- Стили: dvo-card классы в существующий стиль-блок.

### Phase 3: Verify (Status: complete)
- node --test (33 тестов) в worktree.
- grep-проверки имени в трёх местах, обезличенность.
- Живая проверка после deploy (отдельное согласование): карточка в вкладке,
  боковой строки нет, сохранение работает.

### Phase 4: Docs+PR (Status: complete)
- README (новое место настроек), AGENTS.md + index.md проекта (создать),
  Memory Brain. Commit, push, WIP PR, merge.

## Decisions Made
- Паттерн fallback: try/catch вокруг ctx.slots.inject как в vision-bridge#44.
- Карточка по умолчанию свернута (как dshmarket); загрузка снапшота остается
  внутри VoiceSection (лениво при первом раскрытии через mount).
- Новых тестов не нужно: чистой логики в карточке нет (issue п.4).

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| (none yet) | | |

## Next Step
Смог на staging (ждет согласования пользователя).

### Phase 5: Deploy+smoke (Status: pending)
- [ ] RELEASE-copy update -> staging install -> UI smoke -> publish version -> prod profile
