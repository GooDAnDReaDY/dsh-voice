// ------------------------------------------------------------------ 72-macros
// Voice action macros configuration card (#167)

function MacrosSection(props) {
  const { t, draft, setTop, writable } = props
  const macros = Array.isArray(draft && draft.voiceMacros) ? draft.voiceMacros : []

  const addMacro = () => {
    const next = [...macros, { trigger: '', template: '' }]
    setTop('voiceMacros', next)
  }

  const updateMacro = (idx, field, val) => {
    const next = macros.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    setTop('voiceMacros', next)
  }

  const removeMacro = (idx) => {
    const next = macros.filter((_, i) => i !== idx)
    setTop('voiceMacros', next)
  }

  return h('div', { className: 'cb-section-card' },
    h('div', { className: 'cb-section-title' },
      h('span', null, '⚡ ' + t('voiceMacrosTitle')),
      h('button', {
        type: 'button',
        className: 'cb-btn cb-btn-secondary',
        style: { fontSize: '11px', padding: '2px 8px' },
        disabled: !writable,
        onClick: addMacro,
      }, '+ ' + t('addMacro')),
    ),
    h('div', { className: 'cb-field-desc' }, t('voiceMacrosDesc')),
    macros.length === 0
      ? h('div', { style: { fontStyle: 'italic', color: 'var(--dsw-alias-label-tertiary)', fontSize: '12px', marginTop: '6px' } },
          'No macros configured.',
        )
      : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' } },
          macros.map((m, idx) =>
            h('div', { key: idx, className: 'dvo-macro-item' },
              h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
                h('input', {
                  type: 'text',
                  className: 'cb-input',
                  style: { flex: '1', height: '28px', fontSize: '12px' },
                  placeholder: t('macroTrigger'),
                  value: m.trigger || '',
                  disabled: !writable,
                  onChange: (e) => updateMacro(idx, 'trigger', e.target.value),
                }),
                h('button', {
                  type: 'button',
                  className: 'cb-btn cb-btn-secondary',
                  style: { padding: '2px 6px', fontSize: '11px', color: 'var(--dsw-alias-state-error-primary)' },
                  disabled: !writable,
                  onClick: () => removeMacro(idx),
                }, t('macroDelete')),
              ),
              h('textarea', {
                className: 'cb-input',
                style: { minHeight: '38px', resize: 'vertical', fontSize: '12px' },
                placeholder: t('macroTemplate') + ' (use {text} for argument)',
                value: m.template || '',
                disabled: !writable,
                onChange: (e) => updateMacro(idx, 'template', e.target.value),
              }),
            ),
          ),
        ),
  )
}
