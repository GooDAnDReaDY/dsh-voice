# AGENTS.md — dsh-voice

Этот файл дополняет корневой `/mnt/external/Project/DEV/AGENTS.md`. Правила
релиза плагинов — в скилле `dhs-plugin-release-workflow`, устройство плагина —
в `dsh-plugin-authoring`.

## Product / Purpose

- Проект: `dsh-voice` (npm `@goodandready/dsh-voice`)
- DEV: `/mnt/external/Project/DEV/dhsplugins/dsh-voice`
- RELEASE: `/mnt/external/Project/RELEASE/dhsplugins/dsh-voice` (источник публикации)
- Назначение: голосовой ввод в DeepSeek Harness Web GUI — диктовка по паузам и
  голосовые сообщения, у каждого своя цепочка STT-провайдеров с фоллбеком.
- Runtime: не сервис, а bundle в профиле web (`$DSH_HOME/profiles/web`);
  установка — `dsh plugin --profile web add @goodandready/dsh-voice`.
- Текущий статус: active (проверено 25.08.2026: установлен 0.7.3, client.js
  отвечает HTTP 200, boot содержит запись плагина).

## Essential Files

- `lib/client.js` — браузерная половина: кнопки композера, запись, карточка
  настроек (`settings.plugin.item`, ключ = NS `dsh-voice`; запасной путь —
  старый `settings.section`, если слота нет в сборке).
- `lib/index.js` — хост: конфиг, роуты `/dsh-voice/transcribe` и `/status`,
  тул `transcribe_audio`, автостарт whisper.cpp.
- `lib/providers.js` — провайдеры (чистые функции, сеть инжектится).
- `lib/chain.js`, `lib/wav.js` — фоллбек-цепочка и конвертация в WAV 16k.
- `cordis.patch.yml` — слой профиля; `name:` обязан быть полным npm-именем.

## Hard Rules

- Имя пакета совпадает в трёх местах: `package.json name`, `cordis.patch.yml
  name:`, `client.js load({id})`. Расхождение = UI молча пропадает.
- Обезличенность: ни путей `/mnt|/opt|/home`, ни IP, ни имён машин, ни ключей —
  в коде, README и коммитах. Ключи только именами через credentials-сервис.
- Публикация только из RELEASE после тестов; версии выровнены по всем точкам
  (DEV = RELEASE = профиль = Gitea tag = npm = GitHub tags/releases).
- Карточка настроек проверяет СТАТУС снапшота (`ready/loading/unavailable`),
  а не значение.

## Commands

```bash
node --test test/*.test.mjs   # без сети и харнесса
node dist нет; сборки нет — пакет поставляется исходниками lib/
```
