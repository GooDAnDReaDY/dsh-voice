    // Code casing transformer and verbal filler cleaner (#320, #321)
    const DEV_TRANSLIT = Object.fromEntries('а:a,б:b,в:v,г:g,д:d,е:e,ё:yo,ж:zh,з:z,и:i,й:y,к:k,л:l,м:m,н:n,о:o,п:p,р:r,с:s,т:t,у:u,ф:f,х:h,ц:ts,ч:ch,ш:sh,щ:sch,ъ:,ы:y,ь:,э:e,ю:yu,я:ya'.split(',').map((s) => s.split(':')))
    const CLIENT_DEV_WORDS = Object.fromEntries('юзер:user,айди:id,нейм:name,дата:data,инфо:info,токен:token,конфиг:config,статус:status,счетчик:count,ошибка:error,сообщение:message,кнопка:button,карта:card,список:list,значение:value,ключ:key,макс:max,мин:min,ретрайс:retries,лимит:limit,время:time,таймаут:timeout,путь:path,индекс:index,хэндлер:handler,сервис:service,клиент:client'.split(',').map((s) => s.split(':')))
    function transliterateDevWord(w) {
      const low = String(w || '').toLowerCase()
      return CLIENT_DEV_WORDS[low] || low.split('').map((c) => DEV_TRANSLIT[c] || c).join('')
    }
    function devWordsOf(str) {
      return String(str || '').trim().split(/[\s_-]+/).filter(Boolean).map(transliterateDevWord)
    }
    const caseFn = {
      c: (ws) => ws.length ? ws[0].toLowerCase() + ws.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('') : '',
      p: (ws) => ws.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(''),
      s: (ws) => ws.map((w) => w.toLowerCase()).join('_'),
      u: (ws) => ws.map((w) => w.toUpperCase()).join('_'),
      k: (ws) => ws.map((w) => w.toLowerCase()).join('-'),
    }
    function formatCasingClient(str, tc) {
      const c = String(tc || '').toLowerCase()
      const ws = devWordsOf(str)
      const f = /camel|кэмел/.test(c) ? caseFn.c : /snake|снейк/.test(c) ? caseFn.s : /constant|констант|upper|апер/.test(c) ? caseFn.u : /kebab|кебаб/.test(c) ? caseFn.k : /pascal|паскаль/.test(c) ? caseFn.p : null
      return f ? f(ws) : str
    }
    const CLIENT_CASING_TARGETS = '(?:camel[-_\\s]*case|кэмел[-_\\s]*кейс|snake[-_\\s]*case|снейк[-_\\s]*кейс|constant[-_\\s]*case|upper[-_\\s]*snake|константу|константа|апер[-_\\s]*снейк|kebab[-_\\s]*case|кебаб[-_\\s]*кейс|pascal[-_\\s]*case|паскаль[-_\\s]*кейс)'
    function applyCodeCasing(text) {
      const kw = new RegExp('(^|[.,!?\\s])(?:переменн(?:ую|ая)|функци(?:ю|я)|метод|констант(?:у|а)|класс|компонент|тип|поле|var(?:iable)?|func(?:tion)?|method|const(?:ant)?|class|component)\\s+([a-zA-Zа-яА-ЯёЁ0-9_-]+(?:\\s+[a-zA-Zа-яА-ЯёЁ0-9_-]+){0,3})\\s+(?:в|to|in)\\s+(' + CLIENT_CASING_TARGETS + ')(?=[.,!?\\s]|$)', 'gi')
      const sfx = new RegExp('(^|[.,!?\\s])([a-zA-Zа-яА-ЯёЁ0-9_-]+(?:\\s+[a-zA-Zа-яА-ЯёЁ0-9_-]+){0,2})\\s+(?:в|to|in)\\s+(' + CLIENT_CASING_TARGETS + ')(?=[.,!?\\s]|$)', 'gi')
      return String(text || '')
        .replace(kw, (_, lead, words, tc) => (lead || '') + formatCasingClient(words, tc))
        .replace(sfx, (_, lead, words, tc) => (lead || '') + formatCasingClient(words, tc))
    }
    function cleanFillerWords(text) {
      return String(text || '')
        .replace(/(?<![a-zA-Zа-яА-ЯёЁ0-9])([a-zA-Zа-яА-ЯёЁ0-9]+)\s+\1(?![a-zA-Zа-яА-ЯёЁ0-9])/gi, '$1')
        .replace(/(?<![a-zA-Zа-яА-ЯёЁ0-9])(?:ну\s+типа|как\s+бы|в\s+общем-то|так\s+сказать|короче\s+говоря|ээ+|мм+)(?![a-zA-Zа-яА-ЯёЁ0-9])/gi, '')
        .replace(/(^|[.,!?\s])(?:ну|типа|короче|uh+|um+|you\s+know|basically|sort\s+of|kind\s+of)(?=[.,!?\s]|$)/gi, '$1')
        .replace(/\s+/g, ' ')
        .replace(/\s+([.,!?])/g, '$1')
        .trim()
    }
