    // 1. Connection & Engine Status Card
    function ConnectionStatusCard(props) {
      const t = props.t || moduleT
      const hostOnline = props.hostOnline
      const statusLatency = props.statusLatency
      const whisperRunning = props.whisperRunning
      const providerCount = props.providerCount
      const onRefresh = props.onRefresh
      const onOpenWizard = props.onOpenWizard

      return h('div', { className: 'cb-section-card' },
        h('div', { className: 'cb-section-title' },
          h('span', null, t('statusTitle')),
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            onOpenWizard ? h('button', {
              type: 'button', className: 'cb-btn cb-btn-primary', style: { fontSize: '12px', padding: '4px 10px' },
              onClick: onOpenWizard,
            }, '✨ ' + t('wizardBtnLaunch')) : null,
            h('button', {
              type: 'button', className: 'cb-btn', style: { fontSize: '12px', padding: '4px 8px' },
              onClick: onRefresh,
            }, '🔄 ' + t('refreshStats')),
          ),
        ),
        h('div', { className: 'cb-row', style: { alignItems: 'center', gap: '12px', flexWrap: 'wrap' } },
          h('span', { className: 'cb-badge ' + (hostOnline ? 'cb-badge-ok' : 'cb-badge-err') },
            hostOnline ? (`✓ ${t('hostOnline')} (${statusLatency}ms)`) : (`✗ ${t('hostOffline')}`)
          ),
          h('span', { className: 'cb-badge ' + (whisperRunning ? 'cb-badge-ok' : 'cb-badge-warn') },
            whisperRunning ? (`✓ ${t('whisperReady')}`) : (`· ${t('whisperStopped')}`)
          ),
          h('span', { className: 'cb-badge' }, `${providerCount} ${t('providersAvailable')}`),
        ),
      )
    }
