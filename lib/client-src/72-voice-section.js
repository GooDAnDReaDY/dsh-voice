    // ------------------------------------------------------- settings voice section
    function VoiceSection(props) {
      const t = (props && props.t) || moduleT
      const ctx = props.ctx
      // On a non-localhost page the kernel disables settings entirely: the
      // shared document is not readable, every section gets "unavailable" and
      // writes are dropped. The server does not share that restriction, and
      // dsh-lanmode rebuilds the same mechanics on the same calls. Prefer its
      // service when installed, otherwise the kernel one (fine on loopback).
      const settingsService = (ctx.get && ctx.get('lanSettings')) || ctx.configForms || ctx.settingsScope
      const scope = settingsService && typeof settingsService.get === 'function'
        ? settingsService.get(NS)
        : (settingsService && typeof settingsService.bind === 'function' ? settingsService.bind({ namespace: NS }) : null)
      const [snap, setSnap] = React.useState(null)
      const [draft, setDraft] = React.useState(null)
      const [saved, setSaved] = React.useState(false)
      const [err, setErr] = React.useState('')
      const [serverConfig, setServerConfig] = React.useState(null)
      const [configLoading, setConfigLoading] = React.useState(true)

      React.useEffect(() => {
        let alive = true
        fetch('/dsh-voice/config', { cache: 'no-store' })
          .then((r) => r.json())
          .then((data) => {
            if (alive && data && data.ok && data.config) {
              setServerConfig(data.config)
              setDraft((curr) => curr || deepClone(data.config))
            }
          })
          .catch(() => {})
          .finally(() => {
            if (alive) setConfigLoading(false)
          })
        return () => { alive = false }
      }, [])

      // Hotkey picker: not a name field — press the key you want.
      const [catching, setCatching] = React.useState(false)
      const [jargonInput, setJargonInput] = React.useState(null)
      React.useEffect(() => {
        if (!catching) return undefined
        const onKey = (event) => {
          event.preventDefault()
          event.stopPropagation()
          if (event.key === 'Escape') { setCatching(false); return }
          const chosen = keyFromEvent(event)
          setDraft((d) => Object.assign({}, d || {}, { hotkey: chosen }))
          voice.hotkey = chosen || ''
          if (chosen) {
            installHotkey(ctx, chosen, 'message')
          } else {
            clearGlobalHotkey()
          }
          setCatching(false)
        }
        document.addEventListener('keydown', onKey, true)
        return () => document.removeEventListener('keydown', onKey, true)
      }, [catching, ctx])

      React.useEffect(() => {
        let alive = true
        const render = () => { if (alive && scope && typeof scope.getSnapshot === 'function') setSnap(scope.getSnapshot()) }
        render()
        const off = (scope && typeof scope.subscribe === 'function') ? scope.subscribe(render) : () => {}
        return () => { alive = false; off() }
      }, [scope])

      const [devices, setDevices] = React.useState([])
      React.useEffect(() => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return
        navigator.mediaDevices.enumerateDevices()
          .then((list) => setDevices(list.filter((d) => d.kind === 'audioinput')))
          .catch(() => {})
      }, [])

      const ready = !!serverConfig || (!!snap && snap.status === 'ready')
      const value = (snap && snap.status === 'ready' && snap.value) ? snap.value : (serverConfig || {})
      const writable = ready

      React.useEffect(() => {
        if (ready) return undefined
        let tries = 0
        const timer = setInterval(() => {
          if (tries >= 15) { clearInterval(timer); return }
          tries += 1
          try {
            if (ctx.configForms && typeof ctx.configForms.describe === 'function') {
              ctx.configForms.describe().load()
            } else if (ctx.settingsScope && typeof ctx.settingsScope.describe === 'function') {
              ctx.settingsScope.describe().load()
            }
          } catch (e) { /* service not up yet */ }
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
        const val = value || {}
        voice.settings = Object.assign({}, voice.settings, {
          vadSilenceMs: Number(val.dictation && val.dictation.vadSilenceMs) || 700,
          autoSendMs: Number(val.message && val.message.autoSendMs) || 4000,
          beep: !!val.beep,
          localOnly: !!val.localOnly,
          micDeviceId: String(val.micDeviceId || ''),
          historyLimit: Number(val.historyLimit) || 20,
          voiceCommands: !!val.voiceCommands,
          sendDelayMs: Number(val.dictation && val.dictation.sendDelayMs) || 0,
          stream: !!(val.dictation && val.dictation.stream),
          streamChunkMs: Number(val.dictation && val.dictation.streamChunkMs) || 1200,
          vadAdapt: Number(val.dictation && val.dictation.vadAdapt) || 0,
          wakeWord: String(val.wakeWord || ''),
          bargeIn: !!val.bargeIn,
          polishSend: !!(val.message && val.message.polishSend),
          sessionCommands: !!(val.message && val.message.sessionCommands),
          polishBaseUrl: String(val.polishBaseUrl || ''),
          noiseSuppression: val.noiseSuppression !== false,
          noiseGateDb: Number(val.noiseGateDb !== undefined ? val.noiseGateDb : -45),
          contextGlossary: val.contextGlossary !== false,
          visualizerStyle: val.visualizerStyle || 'liquid-wave',
          gatedTurnTaking: val.gatedTurnTaking !== false,
          autoSendVisualRing: val.autoSendVisualRing !== false,
          voiceActions: val.voiceActions !== false,
          techJargonCorrection: val.techJargonCorrection !== false,
          liveInterimPreview: val.liveInterimPreview !== false,
          structuredPromptVoice: val.structuredPromptVoice !== false,
        })
      }, [ready, value])

      const { sensevoiceState, installingSensevoice, triggerInstallSensevoice } = useSensevoiceInstaller(fetchStatus)

      const { testingMic, testLevel, toggleTestMic, gateDbVal, gateThresholdPercent } = useMicTester(draft, value, setErr)

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

      const { updaterStatus, updating, updaterMsg, updaterLoading, checkUpdater, onUpdateNow } = usePluginUpdater()

      const save = async () => {
        setErr(''); setSaved(false)
        if (!draft) return
        if (jargonInput !== null) {
          const lines = jargonInput.split('\n')
          const parsed = lines
            .map((line) => {
              const parts = line.split(/->|=|:/)
              if (parts.length >= 2) {
                const from = parts[0].trim()
                const to = parts.slice(1).join(':').trim()
                if (from && to) return { from, to }
              }
              return null
            })
            .filter(Boolean)
          draft.jargonDictionary = parsed
        }

        let httpOk = false
        let httpError = null
        try {
          const res = await fetch('/dsh-voice/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: draft }),
          })
          const data = await res.json()
          if (res.ok && data && data.ok) {
            httpOk = true
            if (data.config) {
              setServerConfig(data.config)
            }
          } else {
            httpError = data?.error?.message || data?.error || res.statusText || 'Save failed'
          }
        } catch (e) {
          httpError = e?.message || String(e)
        }

        if (scope && typeof scope.set === 'function') {
          for (const k of Object.keys(draft)) {
            try {
              await scope.set(k, draft[k])
            } catch (e) {
              /* best effort on loopback */
            }
          }
        }

        if (!httpOk) {
          setErr(t('saveFailed') + ': ' + httpError)
          return
        }

        const d = draft || {}
        voice.hotkey = d.hotkey || ''
        if (voice.hotkey) {
          installHotkey(ctx, voice.hotkey, 'message')
        } else {
          clearGlobalHotkey()
        }
        Object.assign(voice.settings, {
          hotkey: d.hotkey || '',
          vadSilenceMs: Number(d.dictation && d.dictation.vadSilenceMs) || 700,
          autoSendMs: Number(d.message && d.message.autoSendMs) || 4000,
          beep: !!d.beep,
          micDeviceId: String(d.micDeviceId || ''),
          historyLimit: Number(d.historyLimit),
          voiceCommands: !!d.voiceCommands,
          sendDelayMs: Number(d.dictation && d.dictation.sendDelayMs) || 0,
          stream: !!(d.dictation && d.dictation.stream),
          streamChunkMs: Number(d.dictation && d.dictation.streamChunkMs) || 1200,
          vadAdapt: Number(d.dictation && d.dictation.vadAdapt) || 0,
          noiseSuppression: d.noiseSuppression !== false,
          noiseGateDb: Number(d.noiseGateDb !== undefined ? d.noiseGateDb : -45),
          contextGlossary: d.contextGlossary !== false,
          visualizerStyle: d.visualizerStyle || 'liquid-wave',
          gatedTurnTaking: d.gatedTurnTaking !== false,
          autoSendVisualRing: d.autoSendVisualRing !== false,
          voiceActions: d.voiceActions !== false,
          techJargonCorrection: d.techJargonCorrection !== false,
          liveInterimPreview: d.liveInterimPreview !== false,
          structuredPromptVoice: d.structuredPromptVoice !== false,
        })
        try { window.dispatchEvent(new CustomEvent('dsh-voice:settings-saved')) } catch (noEvents) { /* nobody */ }

        setSaved(true); setJargonInput(null)
        setTimeout(() => setSaved(false), 2000)
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


      const statsData = (statusData && statusData.providerStats) || {}
      const hostOnline = statusLatency !== null
      const whisperRunning = !!(statusData && statusData.whisperRunning)
      const providerCount = (statusData && Array.isArray(statusData.providers)) ? statusData.providers.length : chainOptions.length

      return React.createElement('div', { className: 'cb-page' },
        // 1. Connection & Engine Status Card
        React.createElement(ConnectionStatusCard, {
          t: t,
          hostOnline: hostOnline,
          statusLatency: statusLatency,
          whisperRunning: whisperRunning,
          providerCount: providerCount,
          onRefresh: fetchStatus,
        }),

        // 2. Dictation Mode Card
        React.createElement('div', { className: 'cb-section-card' },
          React.createElement('div', { className: 'cb-section-title' },
            React.createElement('span', null, '🎙️ ' + t('dictationBtn')),
          ),
          React.createElement('div', { className: 'cb-section-desc' }, t('dictationHint')),
          React.createElement(ChainEditor, {
            t: t, value: draft && draft.dictation ? draft.dictation.chain : [], writable: writable,
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
            t: t, value: draft && draft.message ? draft.message.chain : [], writable: writable,
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

        // 5. Hardware & Audio Engines Card
        React.createElement(HardwareOptionsCard, {
          t: t,
          draft: draft,
          setTop: setTop,
          writable: writable,
          catching: catching,
          setCatching: setCatching,
          devices: devices,
          testingMic: testingMic,
          toggleTestMic: toggleTestMic,
          testLevel: testLevel,
          gateDbVal: gateDbVal,
          gateThresholdPercent: gateThresholdPercent,
          onClearKey: () => {
            setDraft((d) => Object.assign({}, d || {}, { hotkey: '' }))
            voice.hotkey = ''
            clearGlobalHotkey()
          },
        }),

        // 6. SenseVoice Local ASR (1-Click Setup)
        React.createElement(SensevoiceSection, {
          t: t,
          sensevoiceState: sensevoiceState,
          installingSensevoice: installingSensevoice,
          writable: writable,
          onInstall: triggerInstallSensevoice,
        }),

        // 7. Turn-Taking & Audio Coordination
        React.createElement('div', { className: 'cb-section-card' },
          React.createElement('div', { className: 'cb-section-title' },
            React.createElement('span', null, '🎙️ ' + t('turnTakingTitle')),
          ),
          React.createElement('div', { className: 'cb-section-desc' }, t('turnTakingDesc')),
          React.createElement('div', { className: 'cb-grid-2' },
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox',
                checked: draft ? draft.gatedTurnTaking !== false : true,
                disabled: !writable,
                onChange: (e) => setTop('gatedTurnTaking', e.target.checked),
              }),
              t('gatedTurnTaking'),
            ),
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox',
                checked: !!(draft && draft.bargeIn),
                disabled: !writable,
                onChange: (e) => setTop('bargeIn', e.target.checked),
              }),
              t('bargeInDesc'),
            ),
          ),
        ),

        // 8. Hands-free & Smart Actions
        React.createElement('div', { className: 'cb-section-card' },
          React.createElement('div', { className: 'cb-section-title' },
            React.createElement('span', null, '✨ ' + t('smartActionsTitle')),
          ),
          React.createElement('div', { className: 'cb-grid-2' },
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox',
                checked: draft ? draft.liveInterimPreview !== false : true,
                disabled: !writable,
                onChange: (e) => setTop('liveInterimPreview', e.target.checked),
              }),
              t('liveInterimPreview'),
            ),
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox',
                checked: draft ? draft.autoSendVisualRing !== false : true,
                disabled: !writable,
                onChange: (e) => setTop('autoSendVisualRing', e.target.checked),
              }),
              t('autoSendVisualRing'),
            ),
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox',
                checked: draft ? draft.voiceActions !== false : true,
                disabled: !writable,
                onChange: (e) => setTop('voiceActions', e.target.checked),
              }),
              t('voiceActionsLabel'),
            ),
            React.createElement('label', { className: 'cb-check-label' },
              React.createElement('input', {
                type: 'checkbox',
                checked: draft ? draft.structuredPromptVoice !== false : true,
                disabled: !writable,
                onChange: (e) => setTop('structuredPromptVoice', e.target.checked),
              }),
              t('structuredPromptVoice'),
            ),
          ),
        ),

        // 9. Developer Lexicon & IT Jargon
        React.createElement(JargonEditor, {
          t: t,
          draft: draft,
          setTop: setTop,
          writable: writable,
          jargonInput: jargonInput,
          setJargonInput: setJargonInput,
        }),

        // 10. Provider Telemetry & Latency Dashboard
        React.createElement(ProviderDashboard, {
          t: t,
          statsData: statsData,
          onRefresh: fetchStatus,
        }),

        // 7. Plugin Version & Updates Card
        React.createElement(UpdaterCard, {
          t: t,
          updaterStatus: updaterStatus,
          updaterLoading: updaterLoading,
          updating: updating,
          updaterMsg: updaterMsg,
          onCheck: checkUpdater,
          onUpdateNow: onUpdateNow,
        }),

        // Action bar (Save)
        React.createElement('div', { className: 'cb-row' },
          React.createElement('button', { type: 'button', className: 'cb-btn cb-btn-primary', disabled: !writable, onClick: save }, t('save')),
          saved ? React.createElement('span', { className: 'dvs-ok' }, t('saved')) : null,
          err ? React.createElement('span', { className: 'dvs-bad' }, err) : null,
        ),
      )
    }
