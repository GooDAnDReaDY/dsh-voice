    // Local ASR (SenseVoice-Small & Whisper Large-v3-Turbo 1-Click Setup)
    function SensevoiceSection(props) {
      const t = props.t || moduleT
      const sensevoiceState = props.sensevoiceState
      const installingSensevoice = props.installingSensevoice
      const writable = props.writable
      const onInstall = props.onInstall
      const [modelChoice, setModelChoice] = React.useState('sensevoice')

      const isInstalled = Boolean(sensevoiceState && sensevoiceState.installed)
      const currentType = (sensevoiceState && sensevoiceState.modelType) || 'sensevoice'
      const badgeText = isInstalled
        ? (t('sensevoiceReady') + (currentType === 'whisper-turbo' ? ' (whisper-turbo)' : ' (small-int8)'))
        : (installingSensevoice ? t('sensevoiceDownloading') : t('sensevoiceNotInstalled'))

      return h('div', { className: 'cb-section-card' },
        h('div', { className: 'cb-section-title' },
          h('span', null, '⚡ ' + t('sensevoiceTitle')),
          h('span', { className: 'cb-badge ' + (isInstalled ? 'cb-badge-ok' : 'cb-badge-warn') }, badgeText),
        ),
        h('div', { className: 'cb-section-desc' }, t('sensevoiceDesc')),
        h('div', { className: 'dvo-installer-box' },
          h('div', { className: 'cb-row', style: { alignItems: 'center', justifyContent: 'space-between', gap: '12px' } },
            h('select', {
              value: modelChoice,
              disabled: installingSensevoice || !writable,
              onChange: (e) => setModelChoice(e.target.value),
              style: { flex: 1, fontSize: '12px', minWidth: '180px' },
            },
              h('option', { value: 'sensevoice' }, 'SenseVoice-Small (150MB, ~50ms)'),
              h('option', { value: 'whisper-turbo' }, 'Whisper Large-v3-Turbo (800MB, High-Accuracy)'),
            ),
            h('button', {
              type: 'button',
              className: 'cb-btn cb-btn-primary',
              style: { fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' },
              disabled: installingSensevoice || !writable,
              onClick: () => { if (typeof onInstall === 'function') onInstall(modelChoice) },
            }, installingSensevoice ? ('⏳ ' + t('installingSensevoice')) : ('📥 ' + t('installSensevoice'))),
          ),
          h('div', { style: { fontSize: '11px', marginTop: '6px', color: 'var(--dsw-alias-content-secondary)' } },
            sensevoiceState && sensevoiceState.path
              ? ('~/' + sensevoiceState.path.replace(/^.*[\\/](\.dsh[\\/]models[\\/].*)$/, '$1'))
              : ('~/.dsh/models/' + modelChoice)
          ),
          installingSensevoice
            ? h('div', { style: { marginTop: '8px' } },
                h('div', { className: 'dvo-progress-bar' },
                  h('div', { className: 'dvo-progress-bar-fill' })
                ),
                h('div', { style: { fontSize: '11px', marginTop: '4px', color: 'var(--dsw-alias-content-secondary)' } },
                  (sensevoiceState && sensevoiceState.progress) || t('sensevoiceDownloading')
                )
              )
            : null
        )
      )
    }
