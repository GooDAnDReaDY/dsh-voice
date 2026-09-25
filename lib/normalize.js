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

export function applyJargonDictionary(text, customReplacements = []) {
  if (!text || typeof text !== 'string') return text || ''
  let result = text
  for (const item of customReplacements || []) {
    if (!item?.from || !item?.to) continue
    const re = cachedJargonRegex(item.from)
    re.lastIndex = 0
    result = result.replace(re, item.to)
  }
  for (const item of DEFAULT_JARGON_REGEX) {
    item.re.lastIndex = 0
    result = result.replace(item.re, item.to)
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

  return { text: raw, action: null }
}

export function normalizePhrase(text, opts = {}) {
  let out = String(text || '').trim()
  if (!out) return out
  if (opts.digits) out = wordsToDigits(out)
  if (opts.commaSpacing) out = fixCommaSpacing(out)
  if (opts.jargon) out = applyJargonDictionary(out, opts.customJargon)
  if (opts.capSentences) out = capitalizeSentences(out)
  if (opts.trailingPeriod) out = ensureTrailingPeriod(out)
  return out
}