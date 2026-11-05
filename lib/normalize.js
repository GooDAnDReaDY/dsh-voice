// Transcript post-processing before inserting into the composer.
// No network and no cordis — pure functions for unit tests.

export function capitalizeSentences(text) {
  return text.replace(/(^|[.!?\n]\s+)([a-zа-яё])/gi, (m, lead, ch) => lead + ch.toUpperCase())
}

export function fixCommaSpacing(text) {
  return text.replace(/\s*,\s*/g, ', ')
}

export function ensureTrailingPeriod(text) {
  const t = String(text || '').trim()
  if (!t) return t
  if (/[.!?…]$/.test(t)) return t
  return t + '.'
}

// Functional linguistic data for speech-to-text numeral normalization.
// Note: Language processing dictionary for audio transcript conversion, not UI text strings.
const NUM_WORDS = {
  ноль: 0, один: 1, одна: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5,
  шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10, одиннадцать: 11,
  двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15,
  шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19,
  двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60,
  семьдесят: 70, восемьдесят: 80, девяносто: 90, сто: 100, двести: 200,
  триста: 300, четыреста: 400, пятьсот: 500, шестьсот: 600, семьсот: 700,
  восемьсот: 800, девятьсот: 900, тысяча: 1000, тысячи: 1000, тысяч: 1000,
  миллион: 1000000, миллиона: 1000000, миллионов: 1000000,
}

const NUM_NAMES = Object.keys(NUM_WORDS).sort((a, b) => b.length - a.length).join('|')
const NUM_SEQ = new RegExp('(?<![а-яёa-z0-9])(?:' + NUM_NAMES + ')(?:\\s+(?:' + NUM_NAMES + '))*(?![а-яёa-z0-9])', 'gi')

export function wordsToDigits(text) {
  return text.replace(NUM_SEQ, (m) => {
    const parts = m.trim().split(/\s+/)
    let total = 0
    let cur = 0
    for (const w of parts) {
      const v = NUM_WORDS[w.toLowerCase()]
      if (v === 1000 || v === 1000000) { total += (cur || 1) * v; cur = 0 }
      else cur += v
    }
    return String(total + cur)
  })
}

export const DEFAULT_JARGON_DICTIONARY = [
  { from: 'гитхаб', to: 'GitHub' },
  { from: 'гитхабе', to: 'GitHub' },
  { from: 'гитхаба', to: 'GitHub' },
  { from: 'гитлаб', to: 'GitLab' },
  { from: 'гитлабе', to: 'GitLab' },
  { from: 'гитлаба', to: 'GitLab' },
  { from: 'дш', to: 'DSH' },
  { from: 'пнпм', to: 'pnpm' },
  { from: 'нпм', to: 'npm' },
  { from: 'докер', to: 'Docker' },
  { from: 'докера', to: 'Docker' },
  { from: 'докером', to: 'Docker' },
  { from: 'докер-контейнер', to: 'Docker-контейнер' },
  { from: 'докер-контейнеры', to: 'Docker-контейнеры' },
  { from: 'кубер', to: 'Kubernetes' },
  { from: 'кубернетис', to: 'Kubernetes' },
  { from: 'кубернетес', to: 'Kubernetes' },
  { from: 'тайпскрипт', to: 'TypeScript' },
  { from: 'тайпскрипте', to: 'TypeScript' },
  { from: 'тайпскрипта', to: 'TypeScript' },
  { from: 'яваскрипт', to: 'JavaScript' },
  { from: 'джаваскрипт', to: 'JavaScript' },
  { from: 'яваскрипта', to: 'JavaScript' },
  { from: 'джаваскрипта', to: 'JavaScript' },
  { from: 'нода', to: 'Node.js' },
  { from: 'ноде', to: 'Node.js' },
  { from: 'ноды', to: 'Node.js' },
  { from: 'пулл реквест', to: 'PR' },
  { from: 'пулл-реквест', to: 'PR' },
  { from: 'пайплайн', to: 'pipeline' },
  { from: 'пайплайна', to: 'pipeline' },
  { from: 'коммит', to: 'commit' },
  { from: 'коммита', to: 'commit' },
  { from: 'коммиты', to: 'commits' },
  { from: 'бранч', to: 'branch' },
  { from: 'бренч', to: 'branch' },
  { from: 'ворктри', to: 'worktree' },
]

function jargonRegex(from) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![a-zA-Zа-яА-ЯёЁ0-9_-])${escaped}(?![a-zA-Zа-яА-ЯёЁ0-9_-])`, 'gi')
}

const DEFAULT_JARGON_REGEX = DEFAULT_JARGON_DICTIONARY
  .filter((item) => item && item.from && item.to)
  .map((item) => ({ re: jargonRegex(item.from), to: item.to }))

const customJargonRegex = new Map()

function cachedJargonRegex(from) {
  let re = customJargonRegex.get(from)
  if (!re) {
    re = jargonRegex(from)
    customJargonRegex.set(from, re)
  }
  return re
}

export function isRussianLang(lang, text = '') {
  const l = String(lang || '').trim().toLowerCase()
  if (l === 'ru' || l.startsWith('ru-') || l.startsWith('ru_')) return true
  if (l === '' || l === 'auto') return /[а-яё]/i.test(String(text || ''))
  return false
}

export function applyJargonDictionary(text, customReplacements = [], options = {}) {
  if (!text || typeof text !== 'string') return text || ''
  let result = text
  for (const item of customReplacements || []) {
    if (!item?.from || !item?.to) continue
    const re = cachedJargonRegex(item.from)
    re.lastIndex = 0
    result = result.replace(re, item.to)
  }
  if (options.defaultJargon !== false) {
    for (const item of DEFAULT_JARGON_REGEX) {
      item.re.lastIndex = 0
      result = result.replace(item.re, item.to)
    }
  }
  return result
}

export function extractVoiceActions(text) {
  const raw = String(text || '').trim()
  if (!raw) return { text: '', action: null }

  const lower = raw.toLowerCase().replace(/[.!?…]+$/, '').trim()
  if (/^(отправь|отправить|send|send it|send message|发送|发出)$/i.test(lower)) {
    return { text: '', action: 'send' }
  }
  if (/^(отмена|cancel|discard|取消|算了)$/i.test(lower)) {
    return { text: '', action: 'cancel' }
  }
  if (/^(очисти|очистить|clear|clear composer|清空|清除)$/i.test(lower)) {
    return { text: '', action: 'clear' }
  }
  if (/^(новая строка|с новой строки|new line|newline|换行|新行)$/i.test(lower)) {
    return { text: '', action: 'newline' }
  }
  if (/^(отмени последнее|сотри последнее|удали последнее|откати последнее|undo|undo last|undo chunk|撤销|撤销上一句)$/i.test(lower)) {
    return { text: '', action: 'undo_chunk' }
  }

  const trailingSend = /[\s,]+(отправь|отправить|send|send it|发送|发出)[.!?…]*$/i
  if (trailingSend.test(raw)) {
    return { text: raw.replace(trailingSend, '').trim(), action: 'send' }
  }
  const trailingCancel = /[\s,]+(отмена|cancel|取消|算了)[.!?…]*$/i
  if (trailingCancel.test(raw)) {
    return { text: raw.replace(trailingCancel, '').trim(), action: 'cancel' }
  }
  const trailingNewline = /[\s,]+(новая строка|с новой строки|new line|换行|新行)[.!?…]*$/i
  if (trailingNewline.test(raw)) {
    return { text: raw.replace(trailingNewline, '').trim() + '\n', action: 'newline' }
  }
  const trailingUndo = /[\s,]+(отмени последнее|сотри последнее|удали последнее|откати последнее|undo last|undo chunk|撤销上一句)[.!?…]*$/i
  if (trailingUndo.test(raw)) {
    return { text: raw.replace(trailingUndo, '').trim(), action: 'undo_chunk' }
  }

  return { text: raw, action: null }
}


// --- Code Casing and Filler Cleaner (#320, #321) ---

const TRANSLIT = {
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y',
  'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
  'х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
}

const COMMON_DEV_WORDS = {
  'юзер': 'user', 'айди': 'id', 'нейм': 'name', 'дата': 'data', 'инфо': 'info', 'токен': 'token',
  'конфиг': 'config', 'статус': 'status', 'счетчик': 'count', 'ошибка': 'error', 'сообщение': 'message',
  'кнопка': 'button', 'карта': 'card', 'список': 'list', 'значение': 'value', 'ключ': 'key',
  'макс': 'max', 'мин': 'min', 'ретрайс': 'retries', 'лимит': 'limit', 'время': 'time', 'таймаут': 'timeout',
  'путь': 'path', 'индекс': 'index', 'хэндлер': 'handler', 'сервис': 'service', 'клиент': 'client'
}

export function transliterateDevWord(w) {
  const low = String(w || '').toLowerCase()
  if (COMMON_DEV_WORDS[low]) return COMMON_DEV_WORDS[low]
  return low.split('').map((c) => TRANSLIT[c] || c).join('')
}

export function wordsOf(str) {
  return String(str || '').trim().split(/[\s_-]+/).filter(Boolean).map(transliterateDevWord)
}

export function toCamelCase(str) {
  const ws = wordsOf(str)
  if (!ws.length) return ''
  return ws[0].toLowerCase() + ws.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
}

export function toPascalCase(str) {
  const ws = wordsOf(str)
  return ws.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
}

export function toSnakeCase(str) {
  return wordsOf(str).map((w) => w.toLowerCase()).join('_')
}

export function toConstantCase(str) {
  return wordsOf(str).map((w) => w.toUpperCase()).join('_')
}

export function toKebabCase(str) {
  return wordsOf(str).map((w) => w.toLowerCase()).join('-')
}

function formatCasing(wordsStr, targetCase) {
  const c = String(targetCase || '').toLowerCase().replace(/\s+/g, '')
  if (c.includes('camel') || c.includes('кэмел')) return toCamelCase(wordsStr)
  if (c.includes('snake') || c.includes('снейк')) return toSnakeCase(wordsStr)
  if (c.includes('constant') || c.includes('констант') || c.includes('upper') || c.includes('апер')) return toConstantCase(wordsStr)
  if (c.includes('kebab') || c.includes('кебаб')) return toKebabCase(wordsStr)
  if (c.includes('pascal') || c.includes('паскаль')) return toPascalCase(wordsStr)
  return wordsStr
}

const CASING_TARGETS = '(?:camel[-_\\s]*case|кэмел[-_\\s]*кейс|snake[-_\\s]*case|снейк[-_\\s]*кейс|constant[-_\\s]*case|upper[-_\\s]*snake|константу|константа|апер[-_\\s]*снейк|kebab[-_\\s]*case|кебаб[-_\\s]*кейс|pascal[-_\\s]*case|паскаль[-_\\s]*кейс)'

export function applyCodeCasing(text) {
  let t = String(text || '')
  // 1. With explicit keyword: declare variable user id in camelCase
  const keywordRe = new RegExp(`(^|[.,!?\\s])(?:переменную|переменная|поле|функцию|функция|метод|константу|константа|класс|компонент|тип|variable|function|method|constant|class|component)\\s+([a-zA-Zа-яА-ЯёЁ0-9_-]+(?:\\s+[a-zA-Zа-яА-ЯёЁ0-9_-]+){0,3})\\s+(?:в|to|in)\\s+(${CASING_TARGETS})(?=[.,!?\\s]|$)`, 'gi')
  t = t.replace(keywordRe, (_, lead, words, targetCase) => (lead || '') + formatCasing(words, targetCase))

  // 2. Direct suffix: user id in camelCase (1-3 words)
  const suffixRe = new RegExp(`(^|[.,!?\\s])([a-zA-Zа-яА-ЯёЁ0-9_-]+(?:\\s+[a-zA-Zа-яА-ЯёЁ0-9_-]+){0,2})\\s+(?:в|to|in)\\s+(${CASING_TARGETS})(?=[.,!?\\s]|$)`, 'gi')
  t = t.replace(suffixRe, (_, lead, words, targetCase) => (lead || '') + formatCasing(words, targetCase))
  return t
}

export function cleanFillerWords(text) {
  let t = String(text || '')
  // Deduplicate adjacent repeated words in Cyrillic & Latin
  t = t.replace(/(?<![a-zA-Zа-яА-ЯёЁ0-9])([a-zA-Zа-яА-ЯёЁ0-9]+)\s+\1(?![a-zA-Zа-яА-ЯёЁ0-9])/gi, '$1')
  // Remove multi-word Russian fillers and hesitation sounds
  t = t.replace(/(?<![a-zA-Zа-яА-ЯёЁ0-9])(?:ну\s+типа|как\s+бы|в\s+общем-то|так\s+сказать|короче\s+говоря|ээ+|мм+)(?![a-zA-Zа-яА-ЯёЁ0-9])/gi, '')
  // Remove standalone single-word fillers
  t = t.replace(/(^|[.,!?\s])(?:ну|типа|короче)(?=[.,!?\s]|$)/gi, '$1')
  // English fillers
  t = t.replace(/(^|[.,!?\s])(?:uh+|um+|you\s+know|basically|sort\s+of|kind\s+of)(?=[.,!?\s]|$)/gi, '$1')
  // Clean up duplicate spaces and dangling punctuation
  t = t.replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim()
  return t
}

export function normalizePhrase(text, opts = {}) {
  let out = String(text || '').trim()
  if (!out) return out
  const lang = opts.lang ?? opts.language
  const isRu = opts.isRussian ?? (lang !== undefined ? isRussianLang(lang, out) : true)
  if (opts.cleanFillers ?? true) out = cleanFillerWords(out)
  if (opts.codeCasing ?? true) out = applyCodeCasing(out)
  if (opts.digits && isRu) out = wordsToDigits(out)
  if (opts.commaSpacing) out = fixCommaSpacing(out)
  if (opts.jargon) {
    out = applyJargonDictionary(out, opts.customJargon, { defaultJargon: isRu })
  }
  if (opts.capSentences) out = capitalizeSentences(out)
  if (opts.trailingPeriod) out = ensureTrailingPeriod(out)
  return out
}