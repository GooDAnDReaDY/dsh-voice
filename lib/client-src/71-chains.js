    // One chain editor: provider+model rows with reordering.
    function ChainEditor(props) {
      const rows = Array.isArray(props.value) ? props.value : []
      const change = (i, patch) => {
        const next = rows.map((r, k) => (k === i ? Object.assign({}, r, patch) : r))
        props.onChange(next)
      }
      const move = (i, delta) => {
        const j = i + delta
        if (j < 0 || j >= rows.length) return
        const next = rows.slice()
        const tmp = next[i]; next[i] = next[j]; next[j] = tmp
        props.onChange(next)
      }
      const remove = (i) => props.onChange(rows.filter((_, k) => k !== i))
      const add = () => props.onChange(rows.concat([{ provider: 'local-whisper', model: '' }]))
      const options = Array.isArray(props.options) && props.options.length ? props.options : BUILTIN

      return React.createElement('div', { className: 'dvs-block' },
        rows.map((row, i) => React.createElement('div', { className: 'dvs-row', key: i },
          React.createElement('select', {
            value: row.provider, disabled: !props.writable,
            onChange: (e) => change(i, { provider: e.target.value }),
          }, (options.indexOf(row.provider) < 0 ? options.concat([row.provider]) : options)
            .map((p) => React.createElement('option', { key: p, value: p }, p))),
          React.createElement('input', {
            className: 'dvs-model', value: row.model || '', disabled: !props.writable,
            placeholder: modelHint(row.provider), onChange: (e) => change(i, { model: e.target.value }),
          }),
          React.createElement('button', { type: 'button', className: 'dvs-mini', title: t('up'), disabled: !props.writable, onClick: () => move(i, -1) }, '↑'),
          React.createElement('button', { type: 'button', className: 'dvs-mini', title: t('down'), disabled: !props.writable, onClick: () => move(i, 1) }, '↓'),
          React.createElement('button', { type: 'button', className: 'dvs-mini', title: t('remove'), disabled: !props.writable, onClick: () => remove(i) }, '×'),
        )),
        React.createElement('div', { className: 'dvs-row' },
          React.createElement('button', { type: 'button', className: 'dvs-mini', title: t('addProvider'), disabled: !props.writable, onClick: add }, '+'),
          React.createElement('span', { className: 'dvs-sub' }, t('chainHint')),
        ),
      )
    }

    // Custom providers: name, API template, where to call, how to authorize.
    function CustomEditor(props) {
      const rows = Array.isArray(props.value) ? props.value : []
      const change = (i, patch) => props.onChange(rows.map((r, k) => (k === i ? Object.assign({}, r, patch) : r)))
      const remove = (i) => props.onChange(rows.filter((_, k) => k !== i))
      const add = () => props.onChange(rows.concat([
        { key: '', template: 'openai-transcriptions', baseURL: '', model: '', keyEnv: '', prompt: '' },
      ]))
      const field = (i, row, name, placeholder, wide) => React.createElement('input', {
        className: wide ? 'dvs-model' : '', value: row[name] || '', placeholder: placeholder,
        disabled: !props.writable, onChange: (e) => change(i, { [name]: e.target.value }),
      })

      return React.createElement('div', { className: 'dvs-block' },
        rows.map((row, i) => React.createElement('div', { className: 'dvs-card', key: i },
          React.createElement('div', { className: 'dvs-row' },
            field(i, row, 'key', t('customName')),
            React.createElement('select', {
              value: row.template || 'openai-transcriptions', disabled: !props.writable,
              onChange: (e) => change(i, { template: e.target.value }),
            }, TEMPLATES.map((t) => React.createElement('option', { key: t, value: t }, t))),
            React.createElement('button', {
              type: 'button', className: 'dvs-mini', title: t('remove'),
              disabled: !props.writable, onClick: () => remove(i),
            }, '\u00d7'),
          ),
          React.createElement('div', { className: 'dvs-row' },
            field(i, row, 'baseURL', 'https://openrouter.ai/api/v1', true),
          ),
          React.createElement('div', { className: 'dvs-row' },
            field(i, row, 'model', t('customModel'), true),
            field(i, row, 'keyEnv', t('customKeyName')),
          ),
          row.template === 'openai-chat-audio'
            ? React.createElement('div', { className: 'dvs-row' },
              field(i, row, 'prompt', t('customModelHint'), true))
            : null,
        )),
        React.createElement('div', { className: 'dvs-row' },
          React.createElement('button', {
            type: 'button', className: 'dvs-mini', title: t('addCustom'),
            disabled: !props.writable, onClick: add,
          }, '+'),
          React.createElement('span', { className: 'dvs-sub' },
            t('openrouterWarning')),
        ),
      )
    }
