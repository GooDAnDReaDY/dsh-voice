    // ------------------------------------------------------- settings page
    const BUILTIN = [
      'browser', 'deepgram', 'groq', 'hf', 'local-whisper', 'sensevoice',
      // Presets: address and model are filled on the host; only a key is needed.
      'openai', 'siliconflow', 'deepinfra', 'fireworks', 'mistral', 'openrouter',
    ]
    const TEMPLATES = ['openai-transcriptions', 'openai-chat-audio']
    // Resolve at render time: t() must not be captured before locale bind.
    const MODEL_HINT_KEYS = {
      browser: 'browserHint',
      openai: 'openaiHint',
      siliconflow: 'siliconflowHint',
      deepinfra: 'deepinfraHint',
      fireworks: 'fireworksHint',
      mistral: 'mistralHint',
      openrouter: 'openrouterHint',
      'local-whisper': 'localHint',
      sensevoice: 'sensevoiceHint',
    }
    const MODEL_HINT_STATIC = {
      deepgram: 'nova-2',
      groq: 'whisper-large-v3-turbo',
      hf: 'openai/whisper-large-v3',
    }
    function modelHint(provider) {
      const key = MODEL_HINT_KEYS[provider]
      if (key) return t(key)
      return MODEL_HINT_STATIC[provider] || ''
    }
    const LANGS = ['auto', 'ru', 'en', 'uk', 'de']

    const SET_CSS =
      '.cb-page{display:flex;flex-direction:column;gap:18px;padding:4px 0 24px;max-width:960px}' +
      '.cb-section-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:12px}' +
      '.cb-section-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;justify-content:space-between}' +
      '.cb-section-desc{font-size:13px;color:var(--dsw-alias-label-secondary);margin-top:-4px;line-height:1.4}' +
      '.cb-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}' +
      '.cb-grid-2{display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:12px}' +
      '.cb-badge{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);display:inline-flex;align-items:center;gap:4px;font-weight:500}' +
      '.cb-badge-ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);background:rgba(16,185,129,0.08)}' +
      '.cb-badge-warn{border-color:var(--dsw-alias-state-warning-primary);color:var(--dsw-alias-state-warning-primary);background:rgba(245,158,11,0.08)}' +
      '.cb-badge-bad{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);background:rgba(239,68,68,0.08)}' +
      '.cb-input{height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 10px;font-size:13px;box-sizing:border-box}' +
      '.cb-input:focus{outline:none;border-color:var(--dsw-alias-state-brand-primary)}' +
      '.cb-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 12px;font-size:13px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .15s ease}' +
      '.cb-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-4, var(--dsw-alias-bg-layer-2));border-color:var(--dsw-alias-label-dimmed, var(--dsw-alias-border-l2))}' +
      '.cb-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-color:transparent}' +
      '.cb-btn-primary:hover:not(:disabled){background:var(--dsw-alias-label-primary) !important;color:var(--dsw-alias-bg-layer-3) !important;opacity:0.88}' +
      '.cb-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:rgba(239,68,68,0.3)}' +
      '.cb-btn-mini{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:6px;width:28px;height:28px;cursor:pointer;flex:none;display:inline-flex;align-items:center;justify-content:center;padding:0;font-size:13px}' +
      '.cb-btn-mini:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}' +
      '.cb-field{display:flex;flex-direction:column;gap:6px;padding:6px 0;font-size:13px;color:var(--dsw-alias-label-primary)}' +
      '.cb-field select,.cb-field input[type="text"],.cb-field input[type="number"],.cb-field textarea{height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 10px;font-size:13px;box-sizing:border-box}' +
      '.cb-field textarea{height:auto;padding:8px 10px;font-family:inherit}' +
      '.cb-check-label{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--dsw-alias-label-primary);user-select:none}' +
      '.cb-check-label input[type="checkbox"]{width:16px;height:16px;cursor:pointer}' +
      '.cb-alert-err{padding:10px 14px;border-radius:8px;background:rgba(239,68,68,0.1);color:var(--dsw-alias-state-error-primary);font-size:13px}' +
      '.dvs-wrap{display:flex;flex-direction:column;gap:18px;padding:4px 0;max-width:960px}' +
      '.dvs-block{display:flex;flex-direction:column;gap:10px}' +
      '.dvs-h{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}' +
      '.dvs-sub{font-size:12px;color:var(--dsw-alias-label-secondary)}' +
      '.dvs-row{display:flex;gap:8px;align-items:center}' +
      '.dvs-row select,.dvs-row input{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;font-size:13px}' +
      '.dvs-row .dvs-model{flex:1}' +
      '.dvs-card{display:flex;flex-direction:column;gap:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:12px}' +
      '.dvs-card input,.dvs-card select{background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:6px 8px;font-size:13px}' +
      '.dvs-wait{font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.5;max-width:520px}' +
      '.dvs-ok{font-size:12px;color:var(--dsw-alias-state-success-primary)}' +
      '.dvs-bad{font-size:12px;color:var(--dsw-alias-state-error-primary)}' +
      '.dvo-pcard{list-style:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px}' +
      '.dvo-phead{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;display:flex;align-items:center;gap:12px;padding:14px 16px}' +
      '.dvo-pheadtext{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}' +
      '.dvo-ptitle{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}' +
      '.dvo-pdesc{color:var(--dsw-alias-label-secondary);font-size:13px}' +
      '.dvo-pchev{flex:none;display:flex;color:var(--dsw-alias-label-secondary);transition:transform .15s ease}' +
      '.dvo-pcardOpen .dvo-pchev{transform:rotate(180deg)}' +
      '.dvo-pbody{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:12px}'
    const setCssId = 'dsh-voice/settings.module.css'
    if (typeof document !== 'undefined' && !document.querySelector('style[data-dsh-plugin="dsh-voice"][data-plugin-css="' + setCssId + '"]')) {
      const tag = document.createElement('style')
      tag.textContent = SET_CSS
      tag.setAttribute('data-dsh-plugin', 'dsh-voice')
      tag.dataset.pluginCss = setCssId
      document.head.appendChild(tag)
    }

        function createErrorBoundary() {
      if (!React || typeof React.Component !== 'function') {
        return function NoopBoundary(props) { return props?.children || null }
      }
      return class ErrorBoundary extends React.Component {
        constructor(props) {
          super(props)
          this.state = { hasError: false, error: null }
        }
        static getDerivedStateFromError(error) {
          return { hasError: true, error }
        }
        componentDidCatch(error, errorInfo) {
          console.error('[dsh-voice] React Error:', error, errorInfo)
        }
        render() {
          if (this.state.hasError) {
            return React.createElement(
              'div',
              { className: 'cb-alert-err', style: { margin: '12px 0', padding: '14px', borderRadius: '8px' } },
              React.createElement('div', { style: { fontWeight: 600, marginBottom: '6px' } }, '⚠️ ' + t('uiError')),
              React.createElement('div', { style: { fontSize: '12px', wordBreak: 'break-all' } }, String(this.state.error?.message || this.state.error)),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'cb-btn',
                  style: { marginTop: '10px', fontSize: '12px', padding: '4px 10px' },
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
    const ErrorBoundary = createErrorBoundary()

