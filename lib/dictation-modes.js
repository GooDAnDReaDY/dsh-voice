// lib/dictation-modes.js — Dictation post-processing modes (#264)

export const DICTATION_MODES = ['verbatim', 'clean', 'task', 'note']

export const DEFAULT_DICTATION_PROMPTS = {
  clean: 'Fix the punctuation and spelling of this dictated text and remove filler words ("um", "uh", etc.). Keep the original language, technical terms, and meaning intact without adding facts. Reply with the clean text only:\n\n{text}',
  task: 'Convert the following dictated request into a clear, structured agent task with: Problem/Goal, Expected Outcome, Constraints, Acceptance Criteria. Do not invent details not mentioned in the dictation. Keep technical identifiers intact. Reply with the structured task only:\n\n{text}',
  note: 'Extract key points, main ideas, and action items from the following dictation. Only include action items that were explicitly mentioned. Keep original terminology intact. Reply with the structured note only:\n\n{text}',
}

/**
 * Resolve prompt instruction for a dictation sub-mode.
 * @param {string} mode 'verbatim' | 'clean' | 'task' | 'note'
 * @param {Record<string, string>} [customPrompts]
 * @param {string} text Dictated text to format
 * @returns {string|null} null for verbatim (0 LLM calls), prompt string for LLM modes
 */
export function resolveDictationPrompt(mode, customPrompts, text) {
  const m = DICTATION_MODES.includes(mode) ? mode : 'clean'
  if (m === 'verbatim') return null
  const template = (customPrompts && typeof customPrompts[m] === 'string' && customPrompts[m].trim())
    ? customPrompts[m]
    : DEFAULT_DICTATION_PROMPTS[m]
  if (template.includes('{text}')) {
    return template.replaceAll('{text}', text)
  }
  return template + '\n\n' + text
}
