    function ConnectionStatusCard(props) {
      const t = props.t || moduleT
      const hostOnline = props.hostOnline
      const statusLatency = props.statusLatency
      const whisperRunning = props.whisperRunning
      const providerCount = props.providerCount
      const onRefresh = props.onRefresh
      const onOpenWizard = props.onOpenWizard

      return h(UiSectionCard, {
        title: t('statusTitle'),
        actions: h('div', { style: { display: 'flex', gap: DESIGN_TOKENS.space.sm, alignItems: 'center' } },
          onOpenWizard ? h(UiActionButton, {
            variant: 'primary', size: 'sm',
            onClick: onOpenWizard,
          }, '✨ ' + t('wizardBtnLaunch')) : null,
          h(UiActionButton, {
            size: 'sm',
            onClick: onRefresh,
          }, '🔄 ' + t('refreshStats')),
        ),
      },
        h('div', { className: 'cb-row', style: { alignItems: 'center', gap: DESIGN_TOKENS.space.md, flexWrap: 'wrap' } },
          h(UiStatusBadge, { status: hostOnline ? 'ok' : 'err' },
            hostOnline ? (`✓ ${t('hostOnline')} (${statusLatency} ${t('msShort')})`) : (`✗ ${t('hostOffline')}`)
          ),
          h(UiStatusBadge, { status: whisperRunning ? 'ok' : 'warn' },
            whisperRunning ? (`✓ ${t('whisperReady')}`) : (`· ${t('whisperStopped')}`)
          ),
          h(UiStatusBadge, { status: 'neutral' }, `${providerCount} ${t('providersAvailable')}`),
        ),
      )
    }
