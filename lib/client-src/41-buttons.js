    // ----------------------------------------------------------- components
    function VoiceButtons(props) {
      const v = useVoice()
      voice.inputActions = props.inputActions
      voice.input = props.input
      if (v.phase !== 'idle' && v.phase !== 'error' && !hold.armed) return null
      const err = v.phase === 'error'
      const hk = voice.hotkey ? ` (${voice.hotkey})` : ''
      return React.createElement(React.Fragment, null,
        React.createElement('button', {
          type: 'button', className: 'dvo-btn', 'data-err': err ? '1' : '0',
          title: err ? v.error : t('dictationBtn'),
          'aria-label': err ? v.error : t('dictationBtn'),
          onClick: startDictation,
        }, micIcon()),
        React.createElement('button', {
          type: 'button', className: 'dvo-btn' + (hold.armed ? ' dvo-btn-active' : ''), 'data-err': err ? '1' : '0',
          title: err ? v.error : (t('messageBtn') + hk),
          'aria-label': err ? v.error : (t('messageBtn') + hk),
          onPointerDown: (e) => { e.preventDefault(); beginHold('message', e) },
          onPointerUp: () => endHold(false),
          onPointerCancel: () => endHold(true),
          onPointerLeave: (e) => {
            if (hold.armed && (!e.target || typeof e.target.hasPointerCapture !== 'function' || !e.target.hasPointerCapture(e.pointerId))) {
              endHold(true)
            }
          },
        }, waveIcon()),
        voice.lastNote && voice.lastNote.url
          ? React.createElement('button', {
              type: 'button', className: 'dvo-btn' + (voice.showPlayer ? ' dvo-btn-active' : ''),
              title: t('listenBack'),
              'aria-label': t('listenBack'),
              onClick: () => voice.set({ showPlayer: !voice.showPlayer }),
            }, playIcon())
          : null,
      )
    }

