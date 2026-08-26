# Findings #28

- providers.js:129/177 form.append('language', lang); 210/231 auto уже обрабатывается
- whisper.cpp autostart: index.js:167 `-l ${cfg.dictation.language}` — 'auto' надо передать как `-l auto`
- langField: client.js:1157 — value 'ru'; добавить option auto + поддержать пару
- appendDraft(279) — точка вставки текста в композер; нормализация здесь и в final
- voice.settings приходит из /dsh-voice/status (index.js:220-221) — normalize/vadSilenceMs доступны
