// Постобработка распознанного текста перед вставкой в композер.
// Без сети и без cordis — чистые функции, чтобы поведение проверить юнитами.

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

const NUM_WORDS = {
  ноль: 0, один: 1, одна: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5,
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
const NUM_SEQ = new RegExp('(' + NUM_NAMES + ')(?:\\s+(' + NUM_NAMES + '))*', 'gi')

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

export function normalizePhrase(text, opts = {}) {
  let out = String(text || '').trim()
  if (!out) return out
  if (opts.digits) out = wordsToDigits(out)
  if (opts.commaSpacing) out = fixCommaSpacing(out)
  if (opts.capSentences) out = capitalizeSentences(out)
  if (opts.trailingPeriod) out = ensureTrailingPeriod(out)
  return out
}