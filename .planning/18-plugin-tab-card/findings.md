# Findings #18

- Слот settings.plugin.item объявлен пакетом настроек ядра; вкладка перебирает
  пространства настроек и для каждого рисует слот с entryKey = имя пространства.
  Ключ регистрации ОБЯЗАН равняться NS (dsh-voice), иначе тишина.
- Контракт (комментарий в dshmarket client.js): плагин с браузерной половиной
  рисует свою карточку сам; ядро дает flex-колонку и диспетчеризацию слота.
  Хостовые карточки сворачиваются и несут шеврон.
- dsh-vision-bridge/lib/client.js:512-541 - эталон переезда (#44):
  tryPluginItem(){try{ctx.slots.inject('settings.plugin.item',()=>ctx.slots.register({name,key:NS,locale:NS,inject},Card));return true}catch{return false}} else settings.section.
- dshmarket SettingsCard: useState(false) - по умолчанию свернута, данные
  грузятся лениво при первом раскрытии (useEffect по open).
- dsh-voice: история чиста по settings.plugin.item (git log -S пуст) - пишем anew.
- VoiceSection уже сам тянет снапшот через (ctx.get('lanSettings')||settingsScope).bind(NS)
  и проверяет статус ready/loading - тело карточки переиспользуем как есть.
