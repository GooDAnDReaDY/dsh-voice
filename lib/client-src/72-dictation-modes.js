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

  return h('div', { className: 'cb-section-card' },
    h('div', { className: 'cb-section-title' },
      h('span', null, '🎙️ ' + t('dictationModeTitle')),
    ),
    h('div', { className: 'cb-field-desc' }, t('dictationModeDesc')),
    h('div', { className: 'cb-grid-2', style: { marginTop: '8px' } },
      ['clean', 'task', 'note', 'verbatim'].map((m) =>
        h('label', { key: m, className: 'cb-check-label' },
          h('input', {
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
    h('div', { style: { marginTop: '12px', borderTop: '1px solid var(--dsw-alias-border-l1)', paddingTop: '10px' } },
      h('div', { className: 'cb-section-title', style: { fontSize: '13px' } },
        h('span', null, t('dictationPromptsTitle')),
        h('button', {
          type: 'button',
          className: 'cb-btn cb-btn-secondary',
          style: { fontSize: '11px', padding: '2px 8px' },
          disabled: !writable,
          onClick: resetPrompts,
        }, t('resetPrompts')),
      ),
      h('div', { className: 'cb-field-desc' }, t('dictationPromptsDesc')),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' } },
        h('div', null,
          h('label', { className: 'cb-label' }, t('promptClean')),
          h('textarea', {
            className: 'cb-input',
            style: { minHeight: '48px', resize: 'vertical' },
            value: prompts.clean || '',
            placeholder: 'Default: punctuation & filler-word cleanup',
            disabled: !writable,
            onChange: (e) => setPrompt('clean', e.target.value),
          }),
        ),
        h('div', null,
          h('label', { className: 'cb-label' }, t('promptTask')),
          h('textarea', {
            className: 'cb-input',
            style: { minHeight: '48px', resize: 'vertical' },
            value: prompts.task || '',
            placeholder: 'Default: structured problem/outcome/constraints/criteria',
            disabled: !writable,
            onChange: (e) => setPrompt('task', e.target.value),
          }),
        ),
        h('div', null,
          h('label', { className: 'cb-label' }, t('promptNote')),
          h('textarea', {
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
