// lib/macros.js — Dynamic voice action macros parsing & substitution (#167)

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function normalizeMacroPhrase(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[.,!?:;]+$/g, '')
    .replace(/^[.,!?:;]+/g, '')
    .trim()
}

/**
 * Apply configured voice macros to recognized text.
 * @param {string} text Raw speech recognition output
 * @param {Array<{trigger: string, template: string}>} macros Configured voice macros
 * @returns {string} Substituted or original text
 */
export function applyVoiceMacros(text, macros) {
  if (!text || !Array.isArray(macros) || macros.length === 0) return text
  const cleanText = String(text).trim()
  const normText = normalizeMacroPhrase(cleanText)

  for (const macro of macros) {
    if (!macro || typeof macro.trigger !== 'string' || !macro.template) continue
    const trig = normalizeMacroPhrase(macro.trigger)
    if (!trig) continue

    // 1. Exact match
    if (normText === trig) {
      return macro.template.trim()
    }

    // 2. Prefix match
    const trigWordBoundary = new RegExp('^' + escapeRegex(trig) + '(?:\\s+|[:,\\-]\\s*|$)', 'i')
    if (trigWordBoundary.test(normText)) {
      const rest = cleanText.slice(macro.trigger.length).replace(/^[\s,:\-]+/, '').trim()
      let template = String(macro.template).trim()
      if (template.includes('{{text}}') || template.includes('{text}') || template.includes('{input}')) {
        return template
          .replaceAll('{{text}}', rest)
          .replaceAll('{text}', rest)
          .replaceAll('{input}', rest)
      }
      return rest ? (template + '\n' + rest) : template
    }
  }

  return cleanText
}
