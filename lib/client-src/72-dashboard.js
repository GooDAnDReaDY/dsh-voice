    // Provider Telemetry & Latency Dashboard (#266)
    function ProviderDashboard(props) {
      const t = props.t || moduleT
      const statsData = props.statsData || {}
      const recentDiagnostics = props.recentDiagnostics || []
      const [exporting, setExporting] = React.useState(false)
      const [exportMsg, setExportMsg] = React.useState('')

      const exportReport = async () => {
        setExporting(true)
        setExportMsg('')
        try {
          const res = await fetch('/dsh-voice/diagnostics/export')
          const data = await res.json()
          if (!res.ok || !data || !data.ok) {
            throw new Error((data && data.error && data.error.message) || `HTTP ${res.status}`)
          }
          const blob = new Blob([JSON.stringify(data.report || {}, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `dsh-voice-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          setExportMsg('✓ ' + t('diagnosticsExportSuccess'))
        } catch (err) {
          setExportMsg(String(err && err.message ? err.message : err))
        } finally {
          setExporting(false)
        }
      }

      return React.createElement('div', { className: 'cb-section-card' },
        React.createElement('div', { className: 'cb-section-title' },
          React.createElement('span', null, '📊 ' + t('providerDashboard')),
          React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            React.createElement('button', {
              type: 'button',
              className: 'cb-btn',
              style: { fontSize: '12px', padding: '4px 10px' },
              disabled: exporting,
              onClick: exportReport,
            }, exporting ? t('exportingDiagnostics') : ('📥 ' + t('exportDiagnosticsBtn'))),
            React.createElement('button', {
              type: 'button', className: 'cb-btn', style: { fontSize: '12px', padding: '4px 8px' },
              onClick: props.onRefresh,
            }, '🔄 ' + t('refreshStats')),
          ),
        ),
        exportMsg ? React.createElement('div', {
          className: exportMsg.startsWith('✓') ? 'dvs-ok' : 'cb-alert-err',
          style: { fontSize: '12px' },
        }, exportMsg) : null,
        React.createElement('div', { className: 'dvo-dash' },
          React.createElement('div', { className: 'dvo-dash-grid' },
            Object.keys(statsData).length === 0
              ? React.createElement('div', { className: 'dvs-sub' }, t('idle'))
              : Object.entries(statsData).map(([key, item]) => {
                  const avg = item.avgTookMs || 0
                  const hasErrors = item.failures > 0
                  let badgeClass = 'dvo-badge-idle'
                  let badgeText = t('idle')
                  if (item.attempts > 0) {
                    if (hasErrors && item.successes === 0) {
                      badgeClass = 'dvo-badge-err'
                      badgeText = t('error')
                    } else if (avg > 0 && avg < 400) {
                      badgeClass = 'dvo-badge-fast'
                      badgeText = avg + 'ms · ' + t('fast')
                    } else if (avg >= 400 && avg <= 1500) {
                      badgeClass = 'dvo-badge-norm'
                      badgeText = avg + 'ms · ' + t('normal')
                    } else {
                      badgeClass = 'dvo-badge-slow'
                      badgeText = avg + 'ms · ' + t('slow')
                    }
                  }
                  const rate = item.attempts > 0 ? Math.round((item.successes / item.attempts) * 100) : 100
                  return React.createElement('div', { key, className: 'dvo-dash-item', title: item.lastError ? `${t('errorPrefix')}: ${item.lastError}` : '' },
                    React.createElement('div', { className: 'dvo-dash-name' }, key),
                    React.createElement('div', { className: 'dvo-dash-row' },
                      React.createElement('span', { className: 'dvo-badge ' + badgeClass }, badgeText),
                      React.createElement('span', null, rate + '%'),
                    ),
                    React.createElement('div', { className: 'dvo-dash-row' },
                      React.createElement('span', null, `${item.successes}/${item.attempts}`),
                      React.createElement('span', null, t('successRate')),
                    ),
                  )
                }),
          ),
        ),
        // Per-recognition telemetry breakdown list (#266)
        React.createElement('div', { style: { marginTop: '12px', borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: '10px' } },
          React.createElement('div', { className: 'dvs-h', style: { marginBottom: '8px' } }, t('recentRecognitionsTitle')),
          recentDiagnostics.length === 0
            ? React.createElement('div', { className: 'dvs-sub' }, t('noRecognitionsYet'))
            : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                recentDiagnostics.slice(-5).reverse().map((d) => React.createElement('div', {
                  key: d.id,
                  className: 'dvs-card',
                  style: { padding: '8px 12px', fontSize: '12px' },
                },
                  React.createElement('div', { className: 'cb-row', style: { justifyContent: 'space-between', alignItems: 'center' } },
                    React.createElement('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
                      React.createElement('span', { className: 'cb-badge ' + (d.success ? 'cb-badge-ok' : 'cb-badge-err') },
                        d.success ? '✓ ' + (d.provider || 'STT') : '✗ ' + (d.error ? d.error.slice(0, 30) : 'fail')
                      ),
                      React.createElement('span', { className: 'dvs-sub' }, `[${d.mode}/${d.subMode}]`),
                      d.audioBytes ? React.createElement('span', { className: 'dvs-sub' }, t('diagBytes').replace('{bytes}', d.audioBytes)) : null,
                    ),
                    React.createElement('span', { style: { fontWeight: '600' } },
                      t('diagTotal').replace('{ms}', d.totalTookMs)
                    ),
                  ),
                  React.createElement('div', { className: 'cb-row', style: { gap: '12px', marginTop: '4px', fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } },
                    React.createElement('span', null, t('diagVad').replace('{ms}', (d.breakdown && d.breakdown.vadMs) || 0)),
                    React.createElement('span', null, t('diagStt').replace('{ms}', (d.breakdown && d.breakdown.sttMs) || 0)),
                    d.breakdown && d.breakdown.polishMs ? React.createElement('span', null, t('diagPolish').replace('{ms}', d.breakdown.polishMs)) : null,
                    typeof d.wordCount === 'number' ? React.createElement('span', null, t('diagWords').replace('{count}', d.wordCount)) : null,
                  ),
                ))
              ),
          React.createElement('div', { className: 'dvs-sub', style: { marginTop: '8px', fontStyle: 'italic' } },
            t('diagExportNotice')
          ),
        ),
      )
    }
