    // ------------------------------------------------------- settings voice section
    function VoiceSection(props) {
      const t = (props && props.t) || moduleT
      const ctx = props.ctx
      // On a non-localhost page the kernel disables settings entirely: the
      // shared document is not readable, every section gets "unavailable" and
      // writes are dropped. The server does not share that restriction, and
      // dsh-lanmode rebuilds the same mechanics on the same calls. Prefer its
      // service when installed, otherwise the kernel one (fine on loopback).
      const scope = ((ctx.get && ctx.get('lanSettings')) || ctx.settingsScope).bind({ namespace: NS })
      const [snap, setSnap] = React.useState(null)
      const [draft, setDraft] = React.useState(null)
      const [saved, setSaved] = React.useState(false)
      const [err, setErr] = React.useState('')

      // Hotkey picker: not a name field — press the key you want.
      const [catching, setCatching] = React.useState(false)
      React.useEffect(() => {
        if (!catching) return undefined
        const onKey = (event) => {
          event.preventDefault()
          event.stopPropagation()
          if (event.key === 'Escape') { setCatching(false); return }
          const chosen = keyFromEvent(event)
          setDraft((d) => Object.assign({}, d || {}, { hotkey: chosen }))
          setCatching(false)
        }
        document.addEventListener('keydown', onKey, true)
        return () => document.removeEventListener('keydown', onKey, true)
      }, [catching])

      React.useEffect(() => {
        let alive = true
        const render = () => { if (alive) setSnap(scope.getSnapshot()) }
        render()
        const off = scope.subscribe(render)
        return () => { alive = false; off() }
      }, [])

      const [devices, setDevices] = React.useState([])
      React.useEffect(() => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return
        navigator.mediaDevices.enumerateDevices()
          .then((list) => setDevices(list.filter((d) => d.kind === 'audioinput')))
          .catch(() => {})
      }, [])

      const ready = !!snap && snap.status === 'ready'
      const value = ready && snap.value ? snap.value : {}
      const writable = ready && snap.writable !== false

      React.useEffect(() => {
        if (ready) return undefined
        let tries = 0
        const timer = setInterval(() => {
          if (tries >= 15) { clearInterval(timer); return }
          tries += 1
          try { ((ctx.get && ctx.get('lanSettings')) || ctx.settingsScope).describe().load() } catch (e) { /* service not up yet */ }
        }, 1000)
        return () => clearInterval(timer)
      }, [ready])

      const deepClone = (obj) => {
        if (typeof structuredClone === 'function') {
          try { return structuredClone(obj) } catch (e) { /* fallback */ }
        }
        try { return JSON.parse(JSON.stringify(obj)) } catch (e) { return Object.assign({}, obj) }
      }

      React.useEffect(() => { if (ready && draft === null) setDraft(deepClone(value)) }, [ready, draft, value])

      React.useEffect(() => {
        if (!ready) return
        voice.settings = Object.assign({}, voice.settings, {
          vadSilenceMs: Number(value && value.dictation && value.dictation.vadSilenceMs) || 700,
          autoSendMs: Number(value && value.message && value.message.autoSendMs) || 4000,
          beep: !!(snap && snap.beep),
          micDeviceId: String((snap && snap.micDeviceId) || ''),
          historyLimit: Number(snap && snap.historyLimit),
          voiceCommands: !!(snap && snap.voiceCommands),
          sendDelayMs: Number(value && value.dictation && value.dictation.sendDelayMs) || 0,
          stream: !!(value && value.dictation && value.dictation.stream),
          streamChunkMs: Number(value && value.dictation && value.dictation.streamChunkMs) || 1200,
          vadAdapt: Number(value && value.dictation && value.dictation.vadAdapt) || 0,
          wakeWord: String((snap && snap.wakeWord) || ''),
          bargeIn: !!(snap && snap.bargeIn),
          polishSend: !!(value && value.message && value.message.polishSend),
          sessionCommands: !!(value && value.message && value.message.sessionCommands),
          polishBaseUrl: String((snap && snap.polishBaseUrl) || ''),
          noiseSuppression: value.noiseSuppression !== false,
          contextGlossary: value.contextGlossary !== false,
        })
      }, [ready, value, snap])

      const [statusData, setStatusData] = React.useState(null)
      const [statusLatency, setStatusLatency] = React.useState(null)
      const fetchStatus = React.useCallback(() => {
        const start = performance.now()
        const ctrl = new AbortController()
        const tId = setTimeout(() => ctrl.abort(), 5000)
        fetch('/dsh-voice/status', { cache: 'no-store', signal: ctrl.signal })
          .then((r) => r.json())
          .then((data) => {
            clearTimeout(tId)
            setStatusLatency(Math.round(performance.now() - start))
            if (data && data.ok) {
              setStatusData(data)
            }
          })
          .catch(() => {
            clearTimeout(tId)
            setStatusLatency(null)
          })
      }, [])

      React.useEffect(() => {
        fetchStatus()
      }, [fetchStatus])

      if (!ready) {
        const waiting = !snap || snap.status === 'loading'
        return React.createElement('div', { className: 'cb-page' },
          React.createElement('div', { className: 'dvs-wait' }, waiting
            ? t('loadingSettings')
            : t('notReady1')
              + t('notReady2')),
        )
      }

      const setIn = (mode, key, v) => setDraft((d) => {
        const next = deepClone(d || {})
        next[mode] = next[mode] || {}
        next[mode][key] = v
        return next
      })
      const setTop = (key, v) => setDraft((d) => Object.assign({}, d || {}, { [key]: v }))

      const save = async () => {
        setErr(''); setSaved(false)
        if (!draft) return

        const failed = []
        for (const k of Object.keys(draft)) {
          try {
            await scope.set(k, draft[k])
          } catch (e) {
            failed.push(k + ': ' + String(e && e.message ? e.message : e))
          }
        }

        Object.assign(voice.settings, {
          vadSilenceMs: Number(draft.dictation && draft.dictation.vadSilenceMs) || 700,
          autoSendMs: Number(draft.message && draft.message.autoSendMs) || 4000,
          beep: !!draft.beep,
          micDeviceId: String(draft.micDeviceId || ''),
          historyLimit: Number(draft.historyLimit),
          voiceCommands: !!draft.voiceCommands,
          sendDelayMs: Number(draft.dictation && draft.dictation.sendDelayMs) || 0,
          stream: !!(draft.dictation && draft.dictation.stream),
          streamChunkMs: Number(draft.dictation && draft.dictation.streamChunkMs) || 1200,
          vadAdapt: Number(draft.dictation && draft.dictation.vadAdapt) || 0,
          noiseSuppression: draft.noiseSuppression !== false,
          contextGlossary: draft.contextGlossary !== false,
          visualizerStyle: draft.visualizerStyle || 'liquid-wave',
        })
        try { window.dispatchEvent(new CustomEvent('dsh-voice:settings-saved')) } catch (noEvents) { /* nobody */ }

        if (failed.length) { setErr(t('saveFailed') + ' ' + failed.join('; ')); return }
        setSaved(true); setTimeout(() => setSaved(false), 2000)
        fetchStatus()
      }

      const modeVal = (mode, key, fallback) => {
        const m = draft && draft[mode]
        return m && m[key] !== undefined ? m[key] : fallback
      }

      const chainOptions = BUILTIN.concat(
        (draft && Array.isArray(draft.customProviders) ? draft.customProviders : [])
          .map((c) => String(c && c.key || '').trim())
          .filter((k) => k && BUILTIN.indexOf(k) < 0),
      )

      const hotkeyField = () => React.createElement('div', { className: 'cb-field' },
        React.createElement('label', null, t('hotkey')),
        React.createElement('div', { className: 'cb-row' },
          React.createElement('button', {
            type: 'button', className: 'cb-btn cb-btn-primary', disabled: !writable,
            onClick: () => setCatching(true),
          }, catching ? t('pressKey') : keyLabel(draft && draft.hotkey)),
          React.createElement('button', {
            type: 'button', className: 'cb-btn cb-btn-mini', title: t('clearKey'),
            disabled: !writable, onClick: () => setDraft((d) => Object.assign({}, d || {}, { hotkey: '' })),
          }, '×'),
        ),
        React.createElement('span', { className: 'dvs-sub' }, t('hotkeyHint1') + t('hotkeyHint2')),
      )

      const micField = () => React.createElement('div', { className: 'cb-field' },
        React.createElement('label', null, t('mic')),
        React.createElement('select', {
          value: String((snap && snap.micDeviceId) || ''), disabled: !writable,
          onChange: (e) => setTop('micDeviceId', e.target.value),
        },
          React.createElement('option', { value: '' }, t('micDefault')),
          devices.map((d) => React.createElement('option', { key: d.deviceId, value: d.deviceId },
            d.label || d.deviceId.slice(0, 12))),
        ),
      )

      const langField = (mode) => React.createElement('div', { className: 'cb-field' },
        React.createElement('label', null, t('language')),
        React.createElement('select', {
          value: modeVal(mode, 'language', 'ru'), disabled: !writable,
          onChange: (e) => setIn(mode, 'language', e.target.value),
        }, LANGS.map((o) => React.createElement('option', { key: o, value: o }, o))),
      )

      const numField = (mode, key, label, hint) => React.createElement('div', { className: 'cb-field' },
        React.createElement('label', null, label),
        React.createElement('input', {
          type: 'number', value: modeVal(mode, key, ''), disabled: !writable,
          onChange: (e) => setIn(mode, key, Number(e.target.value)),
        }),
        React.createElement('span', { className: 'dvs-sub' }, hint),
      )

      const textField = (key, label, hint) => React.createElement('div', { className: 'cb-field' },
        React.createElement('label', null, label),
        React.createElement('input', {
          type: 'text', value: draft && draft[key] !== undefined ? draft[key] : '', disabled: !writable,
          onChange: (e) => setTop(key, e.target.value),
        }),
        React.createElement('span', { className: 'dvs-sub' }, hint),
      )

      const statsData = (statusData && statusData.providerStats) || {}
      const hostOnline = statusLatency !== null
      const whisperRunning = !!(statusData && statusData.whisperRunning)
      const providerCount = (statusData && Array.isArray(statusData.providers)) ? statusData.providers.length : chainOptions.length

      return React.createElement('div', { className: 'cb-page' },
        // 1. Connection & Engine Status Card
        React.createElement('div', { className: 'cb-section-card' },
          React.createElement('div', { className: 'cb-section-title' },
            React.createElement('span', null, t('statusTitle')),
            React.createElement('button', {
              type: 'button', className: 'cb-btn', style: { fontSize: '12px', padding: '4px 8px' },
              onClick: fetchStatus,
            }, '🔄 ' + t('refreshStats')),
          ),
          React.createElement('div', { className: 'cb-section-desc' }, t('statusDesc')),
          React.createElement('div', { className: 'cb-row' },
            hostOnline
              ? React.createElement('span', { className: 'cb-badge cb-badge-ok' }, '● ' + t('badgeHostOnline').replace('{ms}', statusLatency))
              : React.createElement('span', { className: 'cb-badge cb-badge-bad' }, '● ' + t('badgeHostOffline')),
            whisperRunning
              ? React.createElement('span', { className: 'cb-badge cb-badge-ok' }, '● ' + t('badgeWhisperActive'))
              : React.createElement('span', { className: 'cb-badge cb-badge-warn' }, '○ ' + t('badgeWhisperInactive')),
            React.createElement('span', { className: 'cb-badge cb-badge-ok' }, '✓ ' + t('badgeProviders').replace('{count}', providerCount)),
          ),
        ),

        // 2. Dictation Mode Card
        React.createElement('div', { className: 'cb-section-card' },
          React.createElement('div', { className: 'cb-section-title' },
            React.createElement('span', null, '🎙️ ' + t('dictationBtn')),
          ),
          React.createElement('div', { className: 'cb-section-desc' }, t('dictationHint')),
          React.createElement(ChainEditor, {
            value: draft && draft.dictation ? draft.dictation.chain : [], writable: writable,
            options: chainOptions,
            onChange: (v) => setIn('dictation', 'chain', v),
          }),
          React.createElement('div', { className: 'cb-grid-2' },
            langField('dictation'),
            numField('dictation', 'vadSilenceMs', t('pauseMs'), t('pauseHint')),
            numField('dictation', 'sendDelayMs', t('sendDelay'), t('sendDelayHint')),
            numField('dictation', 'streamChunkMs', t('streamChunkMs'), t('streamHint')),
          ),
          React.createElement('div', { className: 'cb-row' },
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox', checked: !!(draft && draft.dictation && draft.dictation.polish), disabled: !writable,
                onChange: (e) => setIn('dictation', 'polish', e.target.checked),
              }),
              t('polish'),
            ),
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox', checked: !!(draft && draft.dictation && draft.dictation.stream), disabled: !writable,
                onChange: (e) => setIn('dictation', 'stream', e.target.checked),
              }),
              t('stream'),
            ),
          ),
          React.createElement('div', { className: 'cb-field' },
            React.createElement('label', null, t('vadAdapt')),
            React.createElement('input', {
              type: 'range', min: 0, max: 1, step: 0.1,
              value: Number(draft && draft.dictation && draft.dictation.vadAdapt) || 0, disabled: !writable,
              onChange: (e) => setIn('dictation', 'vadAdapt', Number(e.target.value)),
            }),
            React.createElement('span', { className: 'dvs-sub' }, t('vadAdaptHint')),
          ),
          textField('wakeWord', t('wakeWord'), t('wakeWordHint')),
        ),

        // 3. Voice Message Card
        React.createElement('div', { className: 'cb-section-card' },
          React.createElement('div', { className: 'cb-section-title' },
            React.createElement('span', null, '💬 ' + t('messageTitle')),
          ),
          React.createElement('div', { className: 'cb-section-desc' }, t('messageHint')),
          React.createElement(ChainEditor, {
            value: draft && draft.message ? draft.message.chain : [], writable: writable,
            options: chainOptions,
            onChange: (v) => setIn('message', 'chain', v),
          }),
          React.createElement('div', { className: 'cb-grid-2' },
            langField('message'),
            numField('message', 'autoSendMs', t('undoMs'), t('undoHint')),
          ),
          React.createElement('div', { className: 'cb-row' },
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox', checked: !!(draft && draft.message && draft.message.polish), disabled: !writable,
                onChange: (e) => setIn('message', 'polish', e.target.checked),
              }),
              t('polish'),
            ),
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox', checked: !!(draft && draft.message && draft.message.polishSend), disabled: !writable,
                onChange: (e) => setIn('message', 'polishSend', e.target.checked),
              }),
              t('polishSend'),
            ),
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox', checked: !!(draft && draft.message && draft.message.sessionCommands), disabled: !writable,
                onChange: (e) => setIn('message', 'sessionCommands', e.target.checked),
              }),
              t('sessionCommands'),
            ),
          ),
        ),

        // 4. Custom Providers Card
        React.createElement('div', { className: 'cb-section-card' },
          React.createElement('div', { className: 'cb-section-title' },
            React.createElement('span', null, '⚙️ ' + t('customTitle')),
          ),
          React.createElement('div', { className: 'cb-section-desc' }, t('customHint')),
          React.createElement(CustomEditor, {
            value: draft && draft.customProviders ? draft.customProviders : [], writable: writable,
            options: chainOptions,
            onChange: (v) => setTop('customProviders', v),
          }),
        ),

        // 5. Hardware & Local Engines Card
        React.createElement('div', { className: 'cb-section-card' },
          React.createElement('div', { className: 'cb-section-title' },
            React.createElement('span', null, '🔧 ' + t('hardwareTitle')),
          ),
          React.createElement('div', { className: 'cb-section-desc' }, t('hardwareDesc')),
          hotkeyField(),
          micField(),
          React.createElement('div', { className: 'cb-grid-2' },
            textField('whisperUrl', t('whisperEndpoint'), t('whisperEndpointHint')),
            textField('whisperBin', t('whisperBin'), t('whisperBinHint')),
            textField('whisperModel', t('whisperModel'), t('whisperModelHint')),
            textField('deepgramBaseUrl', t('deepgramEndpoint'), t('deepgramEndpointHint')),
            textField('sensevoiceUrl', t('sensevoiceEndpoint'), t('sensevoiceEndpointHint')),
            textField('sensevoiceBin', t('sensevoiceBin'), t('sensevoiceBinHint')),
            textField('sensevoiceModel', t('sensevoiceModel'), t('sensevoiceModelHint')),
            textField('polishBaseUrl', t('polishBaseUrl'), t('polishBaseUrlHint')),
            textField('polishModel', t('polishModel'), ''),
            textField('polishKeyEnv', t('polishKeyEnv'), ''),
          ),
          React.createElement('div', { className: 'cb-row' },
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox', checked: !!(draft && draft.autoStart), disabled: !writable,
                onChange: (e) => setTop('autoStart', e.target.checked),
              }),
              t('whisperAutostart'),
            ),
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox', checked: !!(draft && draft.sensevoiceAutostart), disabled: !writable,
                onChange: (e) => setTop('sensevoiceAutostart', e.target.checked),
              }),
              t('sensevoiceAutostart'),
            ),
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox', checked: !!(draft && draft.localOnly), disabled: !writable,
                onChange: (e) => setTop('localOnly', e.target.checked),
              }),
              t('localOnly'),
            ),
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox', checked: !!(draft && draft.beep), disabled: !writable,
                onChange: (e) => setTop('beep', e.target.checked),
              }),
              t('beep'),
            ),
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox', checked: draft ? draft.noiseSuppression !== false : true, disabled: !writable,
                onChange: (e) => setTop('noiseSuppression', e.target.checked),
              }),
              t('noiseSuppression'),
            ),
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox', checked: draft ? draft.contextGlossary !== false : true, disabled: !writable,
                onChange: (e) => setTop('contextGlossary', e.target.checked),
              }),
              t('contextGlossary'),
            ),
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox', checked: !!(draft && draft.voiceCommands), disabled: !writable,
                onChange: (e) => setTop('voiceCommands', e.target.checked),
              }),
              t('voiceCommandsLabel'),
            ),
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox', checked: !!(draft && draft.normalizeTranscript), disabled: !writable,
                onChange: (e) => setTop('normalizeTranscript', e.target.checked),
              }),
              t('normalizeTranscript'),
            ),
          ),
          React.createElement('div', { className: 'cb-field' },
            React.createElement('label', null, t('visualizerStyle')),
            React.createElement('select', {
              value: String((draft && draft.visualizerStyle) || 'liquid-wave'), disabled: !writable,
              onChange: (e) => setTop('visualizerStyle', e.target.value),
            },
              React.createElement('option', { value: 'liquid-wave' }, t('visLiquidWave')),
              React.createElement('option', { value: 'dynamic-orb' }, t('visDynamicOrb')),
              React.createElement('option', { value: 'bars' }, t('visBars')),
              React.createElement('option', { value: 'off' }, t('visOff')),
            ),
          ),
          React.createElement('div', { className: 'cb-field' },
            React.createElement('label', null, t('vocabulary')),
            React.createElement('textarea', {
              rows: 3, disabled: !writable,
              value: Array.isArray(draft && draft.vocabulary) ? draft.vocabulary.join('\n') : '',
              onChange: (e) => setTop('vocabulary', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean)),
            }),
          ),
        ),

        // 6. Provider Telemetry & Latency Dashboard
        React.createElement('div', { className: 'cb-section-card' },
          React.createElement('div', { className: 'cb-section-title' },
            React.createElement('span', null, '📊 ' + t('providerDashboard')),
            React.createElement('button', {
              type: 'button', className: 'cb-btn', style: { fontSize: '12px', padding: '4px 8px' },
              onClick: fetchStatus,
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
                    return React.createElement('div', { key, className: 'dvo-dash-item', title: item.lastError ? `Error: ${item.lastError}` : '' },
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
        ),

        // Action bar (Save)
        React.createElement('div', { className: 'cb-row' },
          React.createElement('button', { type: 'button', className: 'cb-btn cb-btn-primary', disabled: !writable, onClick: save }, t('save')),
          saved ? React.createElement('span', { className: 'dvs-ok' }, t('saved')) : null,
          err ? React.createElement('span', { className: 'dvs-bad' }, err) : null,
        ),
      )
    }

