  // ------------------------------------------------------- settings voice section
  function VoiceSection(props) {
   const t = (props && props.t) || moduleT
   const ctx = (props && props.ctx) || {}
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
   const [revision, setRevision] = React.useState(null)
   React.useEffect(() => {
    let alive = true
    fetch('/dsh-voice/config', { cache: 'no-store' })
     .then((r) => r.json())
     .then((data) => {
      if (alive && data && data.ok && data.config) {
       setServerConfig(data.config)
       if (typeof data.revision === 'number') setRevision(data.revision)
       setDraft((curr) => curr || deepClone(data.config))
       if (data.config.wizardCompleted !== true) setShowWizard(true)
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
   const [showWizard, setShowWizard] = React.useState(false)
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
   const setTop = (key, val) => {
    setDraft((d) => Object.assign({}, d || {}, { [key]: val }))
   }
   const setIn = (mode, key, val) => {
    setDraft((d) => {
     const next = Object.assign({}, d || {})
     next[mode] = Object.assign({}, next[mode] || {}, { [key]: val })
     return next
    })
   }
   const textField = (key, label, hint) => h('div', { className: 'cb-field' },
    h('label', null, label),
    h('input', {
     type: 'text',
     value: (draft && draft[key]) ?? '',
     disabled: !writable,
     onChange: (e) => setTop(key, e.target.value),
    }),
    hint ? h('span', { className: 'dvs-sub' }, hint) : null,
   )
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
     editablePreview: val.message ? val.message.editablePreview !== false : true,
     sessionCommands: !!(val.message && val.message.sessionCommands),
     polishBaseUrl: String(val.polishBaseUrl || ''),
     noiseSuppression: val.noiseSuppression !== false,
     noiseGateDb: Number(val.noiseGateDb !== undefined ? val.noiseGateDb : -45), bilingualDeveloperPrompt: val.bilingualDeveloperPrompt !== false,
     contextGlossary: val.contextGlossary !== false,
     visualizerStyle: val.visualizerStyle || 'liquid-wave',
     gatedTurnTaking: val.gatedTurnTaking !== false,
     autoSendVisualRing: val.autoSendVisualRing !== false,
     voiceActions: val.voiceActions !== false,
     techJargonCorrection: val.techJargonCorrection !== false,
     liveInterimPreview: val.liveInterimPreview !== false,
     structuredPromptVoice: val.structuredPromptVoice !== false,
     dictationMode: val.dictationMode || 'clean',
     dictationPrompts: val.dictationPrompts || {},
     voiceMacros: Array.isArray(val.voiceMacros) ? val.voiceMacros : [],
     webgpuModel: String(val.webgpuModel || (voice.settings && voice.settings.webgpuModel) || 'onnx-community/whisper-tiny'),
    })
   }, [ready, value])
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
       if (data.sessionToken && typeof window !== 'undefined') window.__dshVoiceToken = data.sessionToken
       if (data.webgpuModel && voice.settings) {
        voice.settings.webgpuModel = data.webgpuModel
       }
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
   const { sensevoiceState, installingSensevoice, triggerInstallSensevoice } = useSensevoiceInstaller(fetchStatus)
   const { testingMic, testLevel, toggleTestMic, gateDbVal, gateThresholdPercent, calibrating, calibrateMsg, calibrateNoise } = useMicTester(draft, value, setErr)
   const { updaterStatus, updating, updaterMsg, updaterMsgKind, updaterLoading, checkUpdater, onUpdateNow } = usePluginUpdater()
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
      body: JSON.stringify({ config: draft, expectedRevision: (typeof revision === 'number' ? revision : undefined) }),
     })
     const data = await res.json()
     if (res.ok && data && data.ok) {
      httpOk = true
      if (data.config) setServerConfig(data.config)
      if (typeof data.revision === 'number') setRevision(data.revision)
     } else if (res.status === 409) {
      httpError = data?.error?.message || 'Settings conflict: parallel changes detected'
     } else {
      httpError = data?.error?.message || data?.error || res.statusText || 'Save failed'
     }
    } catch (e) {
     httpError = e?.message || String(e)
    }
    if (httpOk && scope && typeof scope.set === 'function') {
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
     noiseGateDb: Number(d.noiseGateDb !== undefined ? d.noiseGateDb : -45), bilingualDeveloperPrompt: d.bilingualDeveloperPrompt !== false,
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
   const langField = (mode) => {
    const val = modeVal(mode, 'language', '')
    const opts = SUPPORTED_LANGS.slice()
    if (val && !opts.some((o) => o.code === val)) {
     opts.push({ code: val, labelKey: val, defaultLabel: val })
    }
    return h('div', { className: 'cb-field' },
     h('label', null, t('language')),
     h('select', {
      value: val, disabled: !writable,
      onChange: (e) => setIn(mode, 'language', e.target.value),
     }, opts.map((o) => h('option', { key: o.code || 'auto', value: o.code },
      t(o.labelKey) !== o.labelKey ? t(o.labelKey) : o.defaultLabel
     ))),
    )
   }
   const numField = (mode, key, label, hint) => h('div', { className: 'cb-field' },
    h('label', null, label),
    h('input', {
     type: 'number', value: modeVal(mode, key, ''), disabled: !writable,
     onChange: (e) => setIn(mode, key, Number(e.target.value)),
    }),
    h('span', { className: 'dvs-sub' }, hint),
   )
   const statsData = (statusData && statusData.providerStats) || {}
   const recentDiagnostics = (statusData && statusData.recentDiagnostics) || []
   const hostOnline = statusLatency !== null
   const whisperRunning = !!(statusData && statusData.whisperRunning)
   const providerCount = (statusData && Array.isArray(statusData.providers)) ? statusData.providers.length : chainOptions.length
   return h('div', { className: 'cb-page dvo-settings-root' },
    h(ConnectionStatusCard, {
     t: t,
     hostOnline: hostOnline,
     statusLatency: statusLatency,
     whisperRunning: whisperRunning,
     providerCount: providerCount,
     onRefresh: fetchStatus,
     onOpenWizard: () => setShowWizard((v) => !v),
    }),
    showWizard ? h(FirstRunWizard, {
     t: t,
     draft: draft,
     setTop: setTop,
     writable: writable,
     onClose: () => setShowWizard(false),
    }) : null,
    h('div', { className: 'cb-section-card' },
     h('div', { className: 'cb-section-title' },
      h('span', null, '🎙️ ' + t('dictationBtn')),
     ),
     h('div', { className: 'cb-section-desc' }, t('dictationHint')),
     React.createElement(ChainEditor, {
      t: t, value: draft && draft.dictation ? draft.dictation.chain : [], writable: writable,
      options: chainOptions,
      onChange: (v) => setIn('dictation', 'chain', v),
     }),
     h('div', { className: 'cb-grid-2' },
      langField('dictation'),
      numField('dictation', 'vadSilenceMs', t('pauseMs'), t('pauseHint')),
      numField('dictation', 'sendDelayMs', t('sendDelay'), t('sendDelayHint')),
      numField('dictation', 'streamChunkMs', t('streamChunkMs'), t('streamHint')),
     ),
     h('div', { className: 'cb-row' },
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox', checked: !!(draft && draft.dictation && draft.dictation.polish), disabled: !writable,
        onChange: (e) => setIn('dictation', 'polish', e.target.checked),
       }),
       t('polish'),
      ),
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox', checked: !!(draft && draft.dictation && draft.dictation.stream), disabled: !writable,
        onChange: (e) => setIn('dictation', 'stream', e.target.checked),
       }),
       t('stream'),
      ),
     ),
     h('div', { className: 'cb-field' },
      h('label', null, t('vadAdapt')),
      h('input', {
       type: 'range', min: 0, max: 1, step: 0.1,
       value: Number(draft && draft.dictation && draft.dictation.vadAdapt) || 0, disabled: !writable,
       onChange: (e) => setIn('dictation', 'vadAdapt', Number(e.target.value)),
      }),
      h('span', { className: 'dvs-sub' }, t('vadAdaptHint')),
     ),
     textField('wakeWord', t('wakeWord'), t('wakeWordHint')),
    ),
    h('div', { className: 'cb-section-card' },
     h('div', { className: 'cb-section-title' },
      h('span', null, '💬 ' + t('messageTitle')),
     ),
     h('div', { className: 'cb-section-desc' }, t('messageHint')),
     React.createElement(ChainEditor, {
      t: t, value: draft && draft.message ? draft.message.chain : [], writable: writable,
      options: chainOptions,
      onChange: (v) => setIn('message', 'chain', v),
     }),
     h('div', { className: 'cb-grid-2' },
      langField('message'),
      numField('message', 'autoSendMs', t('undoMs'), t('undoHint')),
     ),
     h('div', { className: 'cb-row' },
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox', checked: !!(draft && draft.message && draft.message.polish), disabled: !writable,
        onChange: (e) => setIn('message', 'polish', e.target.checked),
       }),
       t('polish'),
      ),
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox', checked: !!(draft && draft.message && draft.message.polishSend), disabled: !writable,
        onChange: (e) => setIn('message', 'polishSend', e.target.checked),
       }),
       t('polishSend'),
      ),
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox', checked: !!(draft && draft.message && draft.message.sessionCommands), disabled: !writable,
        onChange: (e) => setIn('message', 'sessionCommands', e.target.checked),
       }),
       t('sessionCommands'),
      ),
     ),
    ),
    h('div', { className: 'cb-section-card' },
     h('div', { className: 'cb-section-title' },
      h('span', null, '⚙️ ' + t('customTitle')),
     ),
     h('div', { className: 'cb-section-desc' }, t('customHint')),
     React.createElement(CustomEditor, {
      value: draft && draft.customProviders ? draft.customProviders : [], writable: writable,
      options: chainOptions,
      onChange: (v) => setTop('customProviders', v),
     }),
    ),
    h(HardwareOptionsCard, {
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
     calibrating: calibrating,
     calibrateMsg: calibrateMsg,
     calibrateNoise: calibrateNoise,
     onClearKey: () => {
      setDraft((d) => Object.assign({}, d || {}, { hotkey: '' }))
      voice.hotkey = ''
      clearGlobalHotkey()
     },
    }),
    h(SensevoiceSection, {
     t: t,
     sensevoiceState: sensevoiceState,
     installingSensevoice: installingSensevoice,
     writable: writable,
     onInstall: triggerInstallSensevoice,
    }),
    h('div', { className: 'cb-section-card' },
     h('div', { className: 'cb-section-title' },
      h('span', null, '🎙️ ' + t('turnTakingTitle')),
     ),
     h('div', { className: 'cb-section-desc' }, t('turnTakingDesc')),
     h('div', { className: 'cb-grid-2' },
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox',
        checked: draft ? draft.gatedTurnTaking !== false : true,
        disabled: !writable,
        onChange: (e) => setTop('gatedTurnTaking', e.target.checked),
       }),
       t('gatedTurnTaking'),
      ),
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox',
        checked: !!(draft && draft.bargeIn),
        disabled: !writable,
        onChange: (e) => setTop('bargeIn', e.target.checked),
       }),
       t('bargeInDesc'),
      ),
     ),
    ),
    h('div', { className: 'cb-section-card' },
     h('div', { className: 'cb-section-title' },
      h('span', null, '✨ ' + t('smartActionsTitle')),
     ),
     h('div', { className: 'cb-grid-2' },
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox',
        checked: draft ? draft.liveInterimPreview !== false : true,
        disabled: !writable,
        onChange: (e) => setTop('liveInterimPreview', e.target.checked),
       }),
       t('liveInterimPreview'),
      ),
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox',
        checked: draft ? draft.autoSendVisualRing !== false : true,
        disabled: !writable,
        onChange: (e) => setTop('autoSendVisualRing', e.target.checked),
       }),
       t('autoSendVisualRing'),
      ),
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox',
        checked: draft ? draft.voiceActions !== false : true,
        disabled: !writable,
        onChange: (e) => setTop('voiceActions', e.target.checked),
       }),
       t('voiceActionsLabel'),
      ),
      h('label', { className: 'cb-check-label' },
       h('input', {
        type: 'checkbox',
        checked: draft ? draft.structuredPromptVoice !== false : true,
        disabled: !writable,
        onChange: (e) => setTop('structuredPromptVoice', e.target.checked),
       }),
       t('structuredPromptVoice'),
      ),
     ),
    ),
    // Dictation Modes & Prompts (#264)
    h(DictationModesSection, {
     t: t,
     draft: draft,
     setTop: setTop,
     writable: writable,
    }),
    // Voice Action Macros (#167)
    h(MacrosSection, {
     t: t,
     draft: draft,
     setTop: setTop,
     writable: writable,
    }),
    h(JargonEditor, {
     t: t,
     draft: draft,
     setTop: setTop,
     writable: writable,
     jargonInput: jargonInput,
     setJargonInput: setJargonInput,
    }),
    h(ProviderDashboard, {
     t: t,
     statsData: statsData,
     recentDiagnostics: recentDiagnostics,
     onRefresh: fetchStatus,
    }),
    h(UpdaterCard, {
     t: t,
     updaterStatus: updaterStatus,
     updaterLoading: updaterLoading,
     updating: updating,
     updaterMsg: updaterMsg,
     updaterMsgKind: updaterMsgKind,
     onCheck: checkUpdater,
     onUpdateNow: onUpdateNow,
    }),
    h('div', { className: 'cb-row' },
     h('button', { type: 'button', className: 'cb-btn cb-btn-primary', disabled: !writable, onClick: save }, t('save')),
     saved ? h('span', { className: 'dvs-ok' }, t('saved')) : null,
     err ? h('span', { className: 'dvs-bad' }, err) : null,
    ),
   )
  }
