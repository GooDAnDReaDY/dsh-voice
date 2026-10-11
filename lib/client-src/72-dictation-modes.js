// ------------------------------------------------------------------ 72-dictation-modes
// Dictation modes configuration card and prompt template editors (#264)

function DictationModesSection(props) {
  const { t, draft, setTop, writable } = props
  const prompts = (draft && draft.dictationPrompts) || {}
  const currentMode = (draft && draft.dictationMode) || 'clean'

  const setPrompt = (key, val) => {
    const updated = { ...prompts, [key]: val }
    setTop('dictationPrompts', updated)
  }

  const resetPrompts = () => {
    setTop('dictationPrompts', { clean: '', task: '', note: '' })
  }

  return React.createElement('div', { className: 'cb-section-card' },
    React.createElement('div', { className: 'cb-section-title' },
      React.createElement('span', null, '🎙️ ' + t('dictationModeTitle')),
    ),
    React.createElement('div', { className: 'cb-field-desc' }, t('dictationModeDesc')),
    React.createElement('div', { className: 'cb-grid-2', style: { marginTop: '8px' } },
      ['clean', 'task', 'note', 'verbatim'].map((m) =>
        React.createElement('label', { key: m, className: 'cb-check-label' },
          React.createElement('input', {
            type: 'radio',
            name: 'dictationMode',
            value: m,
            checked: currentMode === m,
            disabled: !writable,
            onChange: () => setTop('dictationMode', m),
          }),
          getDictationModeLabel(m, t),
        ),
      ),
    ),
    React.createElement('div', { style: { marginTop: '12px', borderTop: '1px solid var(--dsw-alias-border-l1)', paddingTop: '10px' } },
      React.createElement('div', { className: 'cb-section-title', style: { fontSize: '13px' } },
        React.createElement('span', null, t('dictationPromptsTitle')),
        React.createElement('button', {
          type: 'button',
          className: 'cb-btn cb-btn-secondary',
          style: { fontSize: '11px', padding: '2px 8px' },
          disabled: !writable,
          onClick: resetPrompts,
        }, t('resetPrompts')),
      ),
      React.createElement('div', { className: 'cb-field-desc' }, t('dictationPromptsDesc')),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' } },
        React.createElement('div', null,
          React.createElement('label', { className: 'cb-label' }, t('promptClean')),
          React.createElement('textarea', {
            className: 'cb-input',
            style: { minHeight: '48px', resize: 'vertical' },
            value: prompts.clean || '',
            placeholder: 'Default: punctuation & filler-word cleanup',
            disabled: !writable,
            onChange: (e) => setPrompt('clean', e.target.value),
          }),
        ),
        React.createElement('div', null,
          React.createElement('label', { className: 'cb-label' }, t('promptTask')),
          React.createElement('textarea', {
            className: 'cb-input',
            style: { minHeight: '48px', resize: 'vertical' },
            value: prompts.task || '',
            placeholder: 'Default: structured problem/outcome/constraints/criteria',
            disabled: !writable,
            onChange: (e) => setPrompt('task', e.target.value),
          }),
        ),
        React.createElement('div', null,
          React.createElement('label', { className: 'cb-label' }, t('promptNote')),
          React.createElement('textarea', {
            className: 'cb-input',
            style: { minHeight: '48px', resize: 'vertical' },
            value: prompts.note || '',
            placeholder: 'Default: key points & action items summary',
            disabled: !writable,
            onChange: (e) => setPrompt('note', e.target.value),
          }),
        ),
      ),
    ),
  )
}
