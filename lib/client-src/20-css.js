    // ------------------------------------------------------------------ css
    const CSS =
      '.dvo-btn{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0;box-sizing:border-box}' +
      '.dvo-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}' +
      '.dvo-btn[data-err="1"]{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}' +
      '.dvo-pill{display:flex;align-items:center;gap:10px;height:52px;border-radius:26px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);padding:0 14px;width:100%;max-width:720px;margin:0 auto;box-shadow:0 8px 24px rgba(0,0,0,.18);box-sizing:border-box}' +
      '.dvo-pbtn{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;cursor:pointer;padding:0;flex:none;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary)}' +
      '.dvo-pbtn:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dvo-wave{flex:1;min-width:0;max-width:100%;height:40px;width:100%;color:var(--dsw-alias-label-primary)}' +
      '.dvo-status{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary);font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dvo-err{color:var(--dsw-alias-state-error-primary)}' +
      '.dvo-count{font-variant-numeric:tabular-nums;font-size:13px;color:var(--dsw-alias-label-secondary)}' +
      '.dvo-spin{animation:dvo-spin 1s linear infinite}' +
      '@keyframes dvo-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}' +
      '.dvo-btn-active{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}' +
      '.dvo-audio-wrap{display:flex;align-items:center;gap:8px;padding:2px 10px;background:var(--dsw-alias-bg-layer-2);border-radius:14px;border:1px solid var(--dsw-alias-border-l1)}' +
      '.dvo-audio-play{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-1);border:0;cursor:pointer;padding:0}' +
      '.dvo-audio-play:hover{opacity:0.9}' +
      '.dvo-audio-time{font-size:12px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}' +
      '.dvo-dash{display:flex;flex-direction:column;gap:8px;margin-top:8px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px}' +
      '.dvo-dash-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-top:4px}' +
      '.dvo-dash-item{display:flex;flex-direction:column;gap:4px;padding:8px 10px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l1);border-radius:8px}' +
      '.dvo-dash-name{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}' +
      '.dvo-dash-row{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--dsw-alias-label-secondary)}' +
      '.dvo-badge{display:inline-flex;align-items:center;font-size:11px;padding:1px 6px;border-radius:6px;font-weight:600}' +
      '.dvo-badge-fast{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-success-primary);border:1px solid var(--dsw-alias-state-success-primary)}' +
      '.dvo-badge-norm{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-warning-primary);border:1px solid var(--dsw-alias-state-warning-primary)}' +
      '.dvo-badge-slow{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-warning-primary);border:1px solid var(--dsw-alias-border-l2)}' +
      '.dvo-badge-err{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-error-primary);border:1px solid var(--dsw-alias-state-error-primary)}' +
      '.dvo-badge-idle{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}'
    const cssId = 'dsh-voice/client.module.css'
    if (typeof document !== 'undefined' && !document.querySelector('style[data-dsh-plugin="dsh-voice"][data-plugin-css="' + cssId + '"]')) {
      const tag = document.createElement('style')
      tag.textContent = CSS
      tag.setAttribute('data-dsh-plugin', 'dsh-voice')
      tag.dataset.pluginCss = cssId
      document.head.appendChild(tag)
    }

