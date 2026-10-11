// ------------------------------------------------------------------ 45-dictation
// Dictation modes UI helper, mode cycler and labels (#264)

const DICTATION_MODES = ['clean', 'task', 'note', 'verbatim']

function getDictationModeLabel(m, t) {
  const trans = t || moduleT
  if (m === 'verbatim') return trans('modeVerbatim')
  if (m === 'task') return trans('modeTask')
  if (m === 'note') return trans('modeNote')
  return trans('modeClean')
}

function cycleDictationMode() {
  const cur = voice.selectedDictationMode || (voice.settings && voice.settings.dictationMode) || 'clean'
  const nextIdx = (DICTATION_MODES.indexOf(cur) + 1) % DICTATION_MODES.length
  voice.selectedDictationMode = DICTATION_MODES[nextIdx]
  voice.notify()
}
