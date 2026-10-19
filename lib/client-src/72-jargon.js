    // Developer Lexicon & IT Jargon
    function JargonEditor(props) {
      const t = props.t || moduleT
      const draft = props.draft
      const setTop = props.setTop
      const writable = props.writable
      const jargonInput = props.jargonInput
      const setJargonInput = props.setJargonInput

      return h('div', { className: 'cb-section-card' },
        h('div', { className: 'cb-section-title' },
          h('span', null, '📖 ' + t('jargonTitle')),
        ),
        h('label', { className: 'cb-check-label', style: { marginBottom: '8px' } },
          h('input', {
            type: 'checkbox',
            checked: draft ? draft.techJargonCorrection !== false : true,
            disabled: !writable,
            onChange: (e) => setTop('techJargonCorrection', e.target.checked),
          }),
          t('techJargonCorrection'),
        ),
        h('div', { className: 'cb-field' },
          h('label', null, t('jargonAdd') + t('jargonFormatHint')),
          h('textarea', {
            rows: 3,
            disabled: !writable,
            placeholder: t('jargonPlaceholder'),
            value: jargonInput !== null && jargonInput !== undefined
              ? jargonInput
              : (Array.isArray(draft && draft.jargonDictionary)
                  ? draft.jargonDictionary.map((item) => item && item.from ? `${item.from} -> ${item.to}` : '').filter(Boolean).join('\n')
                  : ''),
            onChange: (e) => setJargonInput && setJargonInput(e.target.value),
            onBlur: () => {
              if (jargonInput === null || jargonInput === undefined) return
              const lines = jargonInput.split('\n')
              const parsed = lines
                .map((line) => {
                  const parts = line.split(/->|=|:/)
                  if (parts.length >= 2) {
                    const from = parts[0].trim()
                    const to = parts.slice(1).join(':').trim()
                    if (from && to) return { from, to }
                  }
                  return null
                })
                .filter(Boolean)
              setTop('jargonDictionary', parsed)
            },
          }),
        ),
      )
    }
