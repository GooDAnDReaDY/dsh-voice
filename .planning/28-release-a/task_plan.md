# Task Plan: #28 Release A — распознавание и фидбек (5 фич)

Goal: 5 фич — автозязык, нормализация текста, чистый вывод transcribe_audio,
двуязычная транскрипция, VAD-индикатор. Всё в пределах плагина, без новых
провайдеров/расходов.

Branch: issue-28-release-a (base origin/main 5d7ae49)

## Phases
### Phase 1: Research (Status: complete)
- language: default 'ru', providers.js уже обрабатывают `lang && lang !== 'auto'`
  (авто-поддержка частично есть). Нужно: 'auto' в UI + whisper.cpp `-l auto`.
- Текст вставки: client.js appendDraft() (стр.279); фразы диктовки — onFinal.
- transcribe_audio: index.js (367-...), mode message chain.
- Панель записи: dvo-status / dvo-pill (769-794).

### Phase 2: Implement (Status: in_progress)
- F1 автоязык: опция 'auto' в настройках обеих цепочек + передача в whisper.cpp
- F2 нормализация: lib/normalize.js (капитал после .!?, точка в конце, пробел после запятой)
- F3 чистый формат transcribe_audio: настройка normalize выкл/вкл для файла
- F4 двуязычный: language как 'ru,en'; для API не слать единый (auto-семантика),
  для whisper.cpp -l auto (whisper многозначный)
- F7 VAD-индикатор: метка 'вы говорите/пауза' в панели по vadSilenceMs

### Phase 3: Verify (Status: pending)
- node --test (новые юниты на normalize), node --check, обезличенность, 3-имена

### Phase 4: Docs+release
- README, AGENTS/планы, commit/push/PR/merge, production deploy+smoke после ок

## Decisions
- 'ru,en' для провайдеров == auto (нет единого кода); честно в доке
- normalize применяется к финальному тексту перед вставкой; для browser leg тоже
- transcribe_audio получает normalize из настроек message.normalize

## Next Step
Реализовать lib/normalize.js + юнит-тест, затем интеграция в client/index.
