# index.md — dsh-voice

Голосовой ввод для DeepSeek Harness Web GUI: диктовка (текст дописывается в
композер по паузам) и голосовые сообщения (запись целиком, отправка после окна
отмены). У каждого режима своя цепочка STT-провайдеров с фоллбеком.

- Repo: gitea `goodandready/dsh-voice`; GitHub `GooDAnDReaDY/dsh-voice`;
  npm `@goodandready/dsh-voice`.
- DEV: `/mnt/external/Project/DEV/dhsplugins/dsh-voice`;
  RELEASE: `/mnt/external/Project/RELEASE/dhsplugins/dsh-voice`.
- Установка: `dsh plugin --profile web add @goodandready/dsh-voice`.
- Тесты: `node --test test/*.test.mjs` (без сети).
- Настройки: Настройки → Плагины → Настройки плагинов → «Голос» (карточка,
  `settings.plugin.item`, ключ `dsh-voice`); при отсутствии слота — старый
  боковой раздел.
- Роуты: `POST /dsh-voice/transcribe`, `GET /dsh-voice/status`;
  тул `transcribe_audio`.
- Структура: см. `AGENTS.md` → Essential Files; подробности — README.
