    // Fault-isolated React Error Boundary for voice UI sections (#303)
    function createErrorBoundary(defaultSection) {
      if (!React || typeof React.Component !== 'function') {
        return function NoopBoundary(props) { return props?.children || null }
      }
      return class VoiceErrorBoundary extends React.Component {
        constructor(props) {
          super(props)
          this.state = { hasError: false, error: null }
        }
        static getDerivedStateFromError(error) {
          return { hasError: true, error }
        }
        componentDidCatch(error, errorInfo) {
          const sec = (this.props && this.props.section) || defaultSection || 'ui'
          console.error('[dsh-voice] React Error (' + sec + '):', error, errorInfo)
        }
        render() {
          if (this.state.hasError) {
            return React.createElement(
              'div',
              { className: 'cb-alert-err', style: { margin: '8px 0', padding: '12px', borderRadius: '8px' } },
              React.createElement('div', { style: { fontWeight: 600, marginBottom: '4px' } }, '⚠️ ' + t('uiError')),
              React.createElement('div', { style: { fontSize: '12px', wordBreak: 'break-all' } }, String(this.state.error?.message || this.state.error)),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'cb-btn',
                  style: { marginTop: '8px', fontSize: '12px', padding: '4px 10px' },
                  onClick: () => this.setState({ hasError: false, error: null }),
                },
                t('retry'),
              ),
            )
          }
          return this.props?.children || null
        }
      }
    }
    const VoiceErrorBoundary = createErrorBoundary('voice')
    const ErrorBoundary = VoiceErrorBoundary
