    // 1. Connection & Engine Status Card
    function ConnectionStatusCard(props) {
      const t = props.t || moduleT
      const hostOnline = props.hostOnline
      const statusLatency = props.statusLatency
      const whisperRunning = props.whisperRunning
      const providerCount = props.providerCount
      const onRefresh = props.onRefresh
      const onOpenWizard = props.onOpenWizard

      return React.createElement('div', { className: 'cb-section-card' },
        React.createElement('div', { className: 'cb-section-title' },
          React.createElement('span', null, t('statusTitle')),
          React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            onOpenWizard ? React.createElement('button', {
              type: 'button', className: 'cb-btn cb-btn-primary', style: { fontSize: '12px', padding: '4px 10px' },
              onClick: onOpenWizard,
            }, '✨ ' + t('wizardBtnLaunch')) : null,
            React.createElement('button', {
              type: 'button', className: 'cb-btn', style: { fontSize: '12px', padding: '4px 8px' },
              onClick: onRefresh,
            }, '🔄 ' + t('refreshStats')),
          ),
        ),
        React.createElement('div', { className: 'cb-row', style: { alignItems: 'center', gap: '12px', flexWrap: 'wrap' } },
          React.createElement('span', { className: 'cb-badge ' + (hostOnline ? 'cb-badge-ok' : 'cb-badge-err') },
            hostOnline ? (`✓ ${t('hostOnline')} (${statusLatency}ms)`) : (`✗ ${t('hostOffline')}`)
          ),
          React.createElement('span', { className: 'cb-badge ' + (whisperRunning ? 'cb-badge-ok' : 'cb-badge-warn') },
            whisperRunning ? (`✓ ${t('whisperReady')}`) : (`· ${t('whisperStopped')}`)
          ),
          React.createElement('span', { className: 'cb-badge' }, `${providerCount} ${t('providersAvailable')}`),
        ),
      )
    }
