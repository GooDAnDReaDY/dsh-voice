    // Provider Telemetry & Latency Dashboard
    function ProviderDashboard(props) {
      const t = props.t || moduleT
      const statsData = props.statsData || {}
      return React.createElement('div', { className: 'cb-section-card' },
        React.createElement('div', { className: 'cb-section-title' },
          React.createElement('span', null, '📊 ' + t('providerDashboard')),
          React.createElement('button', {
            type: 'button', className: 'cb-btn', style: { fontSize: '12px', padding: '4px 8px' },
            onClick: props.onRefresh,
          }, '🔄 ' + t('refreshStats')),
        ),
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
      )
    }
