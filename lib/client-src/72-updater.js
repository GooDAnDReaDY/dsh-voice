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

      return h('div', { className: 'cb-section-card' },
        h('div', { className: 'cb-section-title' },
          h('span', null, '📦 ' + t('versionTitle')),
          h('button', {
            type: 'button', className: 'cb-btn', style: { fontSize: '12px', padding: '4px 8px' },
            onClick: onCheck, disabled: updaterLoading || updating,
          }, updaterLoading ? '⏳…' : '🔄 ' + t('refreshStats')),
        ),
        h('div', { className: 'cb-section-desc' }, t('versionHint')),
        h('div', { className: 'cb-row', style: { alignItems: 'center', gap: '12px' } },
          updaterStatus && updaterStatus.currentVersion
            ? h('span', { className: 'cb-badge cb-badge-ok' }, 'v' + updaterStatus.currentVersion)
            : null,
          updaterLoading && (!updaterStatus || !updaterStatus.currentVersion)
            ? h('span', { className: 'cb-badge' }, '⏳ ' + t('checkingUpdates'))
            : !updaterStatus
              ? h('span', { className: 'cb-badge cb-badge-warn' }, '❓ ' + t('updateStatusUnknown'))
              : updaterStatus.updateAvailable
                ? h('span', { className: 'cb-badge cb-badge-warn' },
                    t('updateAvailable') + ': v' + updaterStatus.latestVersion
                  )
                : updaterStatus.latestCheckFailed
                  ? h('span', { className: 'cb-badge cb-badge-warn' },
                      '⚠️ ' + t('updateCheckFailed')
                    )
                  : h('span', { className: 'cb-badge cb-badge-ok' },
                      t('upToDate')
                    ),
          updaterStatus && updaterStatus.updateAvailable
            ? h('button', {
                type: 'button', className: 'cb-btn cb-btn-primary', style: { fontSize: '12px', padding: '4px 10px' },
                onClick: onUpdateNow, disabled: updating,
              }, updating ? t('updating') : t('updateNow'))
            : null,
        ),
        updaterMsg
          ? h('div', {
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
