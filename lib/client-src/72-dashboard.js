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

      return h('div', { className: 'cb-section-card' },
        h('div', { className: 'cb-section-title' },
          h('span', null, '📊 ' + t('providerDashboard')),
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            h('button', {
              type: 'button',
              className: 'cb-btn',
              style: { fontSize: '12px', padding: '4px 10px' },
              disabled: exporting,
              onClick: exportReport,
            }, exporting ? t('exportingDiagnostics') : ('📥 ' + t('exportDiagnosticsBtn'))),
            h('button', {
              type: 'button', className: 'cb-btn', style: { fontSize: '12px', padding: '4px 8px' },
              onClick: props.onRefresh,
            }, '🔄 ' + t('refreshStats')),
          ),
        ),
        exportMsg ? h('div', {
          className: exportMsg.startsWith('✓') ? 'dvs-ok' : 'cb-alert-err',
          style: { fontSize: '12px' },
        }, exportMsg) : null,
        h('div', { className: 'dvo-dash' },
          h('div', { className: 'dvo-dash-grid' },
            Object.keys(statsData).length === 0
              ? h('div', { className: 'dvs-sub' }, t('idle'))
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
                  return h('div', { key, className: 'dvo-dash-item', title: item.lastError ? `${t('errorPrefix')}: ${item.lastError}` : '' },
                    h('div', { className: 'dvo-dash-name' }, key),
                    h('div', { className: 'dvo-dash-row' },
                      h('span', { className: 'dvo-badge ' + badgeClass }, badgeText),
                      h('span', null, rate + '%'),
                    ),
                    h('div', { className: 'dvo-dash-row' },
                      h('span', null, `${item.successes}/${item.attempts}`),
                      h('span', null, t('successRate')),
                    ),
                  )
                }),
          ),
        ),
        // Per-recognition telemetry breakdown list (#266)
        h('div', { style: { marginTop: '12px', borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: '10px' } },
          h('div', { className: 'dvs-h', style: { marginBottom: '8px' } }, t('recentRecognitionsTitle')),
          recentDiagnostics.length === 0
            ? h('div', { className: 'dvs-sub' }, t('noRecognitionsYet'))
            : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                recentDiagnostics.slice(-5).reverse().map((d) => h('div', {
                  key: d.id,
                  className: 'dvs-card',
                  style: { padding: '8px 12px', fontSize: '12px' },
                },
                  h('div', { className: 'cb-row', style: { justifyContent: 'space-between', alignItems: 'center' } },
                    h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
                      h('span', { className: 'cb-badge ' + (d.success ? 'cb-badge-ok' : 'cb-badge-err') },
                        d.success ? '✓ ' + (d.provider || 'STT') : '✗ ' + (d.error ? d.error.slice(0, 30) : 'fail')
                      ),
                      h('span', { className: 'dvs-sub' }, `[${d.mode}/${d.subMode}]`),
                      d.audioBytes ? h('span', { className: 'dvs-sub' }, t('diagBytes').replace('{bytes}', d.audioBytes)) : null,
                    ),
                    h('span', { style: { fontWeight: '600' } },
                      t('diagTotal').replace('{ms}', d.totalTookMs)
                    ),
                  ),
                  h('div', { className: 'cb-row', style: { gap: '12px', marginTop: '4px', fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } },
                    h('span', null, t('diagVad').replace('{ms}', (d.breakdown && d.breakdown.vadMs) || 0)),
                    h('span', null, t('diagStt').replace('{ms}', (d.breakdown && d.breakdown.sttMs) || 0)),
                    d.breakdown && d.breakdown.polishMs ? h('span', null, t('diagPolish').replace('{ms}', d.breakdown.polishMs)) : null,
                    typeof d.wordCount === 'number' ? h('span', null, t('diagWords').replace('{count}', d.wordCount)) : null,
                  ),
                ))
              ),
          h('div', { className: 'dvs-sub', style: { marginTop: '8px', fontStyle: 'italic' } },
            t('diagExportNotice')
          ),
        ),
      )
    }
