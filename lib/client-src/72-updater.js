    // Plugin Version & Updates Card
    function UpdaterCard(props) {
      const t = props.t || moduleT
      const updaterStatus = props.updaterStatus
      const updaterLoading = props.updaterLoading
      const updating = props.updating
      const updaterMsg = props.updaterMsg
      const updaterMsgKind = props.updaterMsgKind
      const onCheck = props.onCheck
      const onUpdateNow = props.onUpdateNow

      return React.createElement('div', { className: 'cb-section-card' },
        React.createElement('div', { className: 'cb-section-title' },
          React.createElement('span', null, '📦 ' + t('versionTitle')),
          React.createElement('button', {
            type: 'button', className: 'cb-btn', style: { fontSize: '12px', padding: '4px 8px' },
            onClick: onCheck, disabled: updaterLoading || updating,
          }, updaterLoading ? '⏳…' : '🔄 ' + t('refreshStats')),
        ),
        React.createElement('div', { className: 'cb-section-desc' }, t('versionHint')),
        React.createElement('div', { className: 'cb-row', style: { alignItems: 'center', gap: '12px' } },
          updaterStatus && updaterStatus.currentVersion
            ? React.createElement('span', { className: 'cb-badge cb-badge-ok' }, 'v' + updaterStatus.currentVersion)
            : null,
          updaterLoading && (!updaterStatus || !updaterStatus.currentVersion)
            ? React.createElement('span', { className: 'cb-badge' }, '⏳ ' + t('checkingUpdates'))
            : !updaterStatus
              ? React.createElement('span', { className: 'cb-badge cb-badge-warn' }, '❓ ' + t('updateStatusUnknown'))
              : updaterStatus.updateAvailable
                ? React.createElement('span', { className: 'cb-badge cb-badge-warn' },
                    t('updateAvailable') + ': v' + updaterStatus.latestVersion
                  )
                : updaterStatus.latestCheckFailed
                  ? React.createElement('span', { className: 'cb-badge cb-badge-warn' },
                      '⚠️ ' + t('updateCheckFailed')
                    )
                  : React.createElement('span', { className: 'cb-badge cb-badge-ok' },
                      t('upToDate')
                    ),
          updaterStatus && updaterStatus.updateAvailable
            ? React.createElement('button', {
                type: 'button', className: 'cb-btn cb-btn-primary', style: { fontSize: '12px', padding: '4px 10px' },
                onClick: onUpdateNow, disabled: updating,
              }, updating ? t('updating') : t('updateNow'))
            : null,
        ),
        updaterMsg
          ? React.createElement('div', {
              style: {
                marginTop: '8px',
                fontSize: '12px',
                color: (updaterMsgKind === 'err' || (!updaterMsgKind && (updaterMsg.includes('fail') || updaterMsg.includes('失败'))))
                  ? 'var(--dsw-alias-state-warning-primary)'
                  : 'var(--dsw-alias-state-success-primary)',
              },
            }, updaterMsg)
          : null,
      )
    }
