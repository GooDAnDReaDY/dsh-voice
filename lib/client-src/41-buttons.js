    // ----------------------------------------------------------- components
    function VoiceButtons(props) {
      const v = useVoice()
      voice.inputActions = props.inputActions
      voice.input = props.input
      if (v.phase !== 'idle' && v.phase !== 'error') return null
      const err = v.phase === 'error'
      return React.createElement(React.Fragment, null,
        React.createElement('button', {
          type: 'button', className: 'dvo-btn', 'data-err': err ? '1' : '0',
          title: err ? v.error : t('dictationBtn'), onClick: startDictation,
        }, micIcon()),
        React.createElement('button', {
          type: 'button', className: 'dvo-btn', 'data-err': err ? '1' : '0',
          title: err ? v.error : t('messageBtn'),
          // Hold: record while pressed; leaving the control cancels.
          onPointerDown: (e) => { e.preventDefault(); beginHold('message') },
          onPointerUp: () => endHold(false),
          onPointerLeave: () => { if (hold.armed) endHold(true) },
        }, waveIcon()),
        voice.lastNote && voice.lastNote.url
          ? React.createElement('button', {
              type: 'button', className: 'dvo-btn' + (voice.showPlayer ? ' dvo-btn-active' : ''),
              title: t('listenBack'),
              onClick: () => voice.set({ showPlayer: !voice.showPlayer }),
            }, playIcon())
          : null,
      )
    }

