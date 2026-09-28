    // SenseVoice Local ASR (1-Click Setup)
    function SensevoiceSection(props) {
      const t = props.t || moduleT
      const sensevoiceState = props.sensevoiceState
      const installingSensevoice = props.installingSensevoice
      const writable = props.writable
      const onInstall = props.onInstall

      return React.createElement('div', { className: 'cb-section-card' },
        React.createElement('div', { className: 'cb-section-title' },
          React.createElement('span', null, '⚡ ' + t('sensevoiceTitle')),
          sensevoiceState && sensevoiceState.installed
            ? React.createElement('span', { className: 'cb-badge cb-badge-ok' }, t('sensevoiceReady') + ' (small-int8)')
            : React.createElement('span', { className: 'cb-badge cb-badge-warn' },
                installingSensevoice ? t('sensevoiceDownloading') : t('sensevoiceNotInstalled')
              ),
        ),
        React.createElement('div', { className: 'cb-section-desc' }, t('sensevoiceDesc')),
        React.createElement('div', { className: 'dvo-installer-box' },
          React.createElement('div', { className: 'cb-row', style: { alignItems: 'center', justifyContent: 'space-between', gap: '12px' } },
            React.createElement('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-content-secondary)' } },
              sensevoiceState && sensevoiceState.path
                ? ('~/' + sensevoiceState.path.replace(/^.*[\\/](\.dsh[\\/]models[\\/].*)$/, '$1'))
                : '~/.dsh/models/sensevoice'
            ),
            React.createElement('button', {
              type: 'button',
              className: 'cb-btn cb-btn-primary',
              style: { fontSize: '12px', padding: '6px 12px' },
              disabled: installingSensevoice || !writable,
              onClick: onInstall,
            }, installingSensevoice ? ('⏳ ' + t('installingSensevoice')) : ('📥 ' + t('installSensevoice'))),
          ),
          installingSensevoice
            ? React.createElement('div', { style: { marginTop: '8px' } },
                React.createElement('div', { className: 'dvo-progress-bar' },
                  React.createElement('div', { className: 'dvo-progress-bar-fill' })
                ),
                React.createElement('div', { style: { fontSize: '11px', marginTop: '4px', color: 'var(--dsw-alias-content-secondary)' } },
                  (sensevoiceState && sensevoiceState.progress) || t('sensevoiceDownloading')
                )
              )
            : null
        )
      )
    }
