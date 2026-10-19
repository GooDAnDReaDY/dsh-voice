  // 5. Hardware & Audio Engines Card
  function HardwareOptionsCard(props) {
   const {
    t = moduleT, draft, setTop, writable, catching, setCatching,
    devices = [], testingMic, toggleTestMic, testLevel = 0,
    gateDbVal, gateThresholdPercent, calibrating, calibrateMsg, calibrateNoise, onClearKey
   } = props

   const [benchmarking, setBenchmarking] = React.useState(false)
   const [benchmarkResult, setBenchmarkResult] = React.useState(null)
   const [benchmarkErr, setBenchmarkErr] = React.useState('')

   const runBenchmark = () => {
  setBenchmarking(true)
  setBenchmarkErr('')
  fetch('/dsh-voice/benchmark', {
   method: 'POST',
   headers: {
   'x-dsh-plugin-update': '1',
   'Content-Type': 'application/json',
   },
  })
   .then((r) => r.json())
   .then((d) => {
   setBenchmarking(false)
   if (d && d.ok) setBenchmarkResult(d)
   else setBenchmarkErr((d && d.error && d.error.message) || 'Benchmark failed')
   })
   .catch((e) => {
   setBenchmarking(false)
   setBenchmarkErr((e && e.message) || 'Network error')
   })
   }

   const textField = (key, label, hint) => h('div', { className: 'cb-field' },
  h('label', null, label),
  h('input', {
   type: 'text', value: draft && draft[key] !== undefined ? draft[key] : '', disabled: !writable,
   onChange: (e) => setTop(key, e.target.value),
  }),
  h('span', { className: 'dvs-sub' }, hint),
   )

   return h('div', { className: 'cb-section-card' },
  h('div', { className: 'cb-section-title' },
   h('span', null, '⚙️ ' + t('hardwareTitle')),
  ),
  h('div', { className: 'cb-section-desc' }, t('hardwareDesc')),
  // Hotkey picker
  h('div', { className: 'cb-field' },
   h('label', null, t('hotkey')),
   h('div', { className: 'cb-row' },
   h('button', {
    type: 'button', className: 'cb-btn cb-btn-primary', disabled: !writable,
    onClick: () => setCatching(true),
   }, catching ? t('pressKey') : keyLabel(draft && draft.hotkey)),
   h('button', {
    type: 'button', className: 'cb-btn cb-btn-mini', title: t('clearKey'),
    disabled: !writable, onClick: onClearKey,
   }, '×'),
   ),
   h('span', { className: 'dvs-sub' }, t('hotkeyHint1') + t('hotkeyHint2')),
  ),
  // Mic & noise gate
  h('div', { className: 'cb-field' },
   h('label', null, t('mic')),
   h('div', { className: 'cb-row' },
   h('select', {
    value: String((draft && draft.micDeviceId) ?? ''), disabled: !writable || testingMic,
    onChange: (e) => setTop('micDeviceId', e.target.value),
    style: { flex: 1 },
   },
    h('option', { value: '' }, t('micDefault')),
    devices.map((d) => h('option', { key: d.deviceId, value: d.deviceId },
    d.label || d.deviceId.slice(0, 12))),
   ),
   h('button', {
    type: 'button',
    className: 'cb-btn ' + (testingMic ? 'cb-btn-primary' : 'cb-btn-secondary'),
    onClick: toggleTestMic,
    style: { flex: 'none' },
   }, testingMic ? t('stopTest') : t('testMic')),
   h('button', {
    type: 'button',
    className: 'cb-btn cb-btn-secondary',
    onClick: () => (typeof calibrateNoise === 'function' ? calibrateNoise(setTop, t) : null),
    disabled: calibrating || !writable,
    style: { flex: 'none' },
    title: t('calibrateNoiseHint') || '',
   }, calibrating ? t('calibrating') : t('calibrateNoise')),
   ),
   calibrateMsg ? h('div', {
    style: { fontSize: '11px', color: 'var(--dsw-alias-state-success-primary)', marginTop: '4px' },
   }, calibrateMsg) : null,
   testingMic ? h('div', { className: 'dvo-mic-test' },
   h('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, t('micLevel') + ':'),
   h('div', { className: 'dvo-meter-bar' },
    h('div', { className: 'dvo-meter-fill', style: { width: `${testLevel}%` } }),
    gateThresholdPercent > 0 ? h('div', { className: 'dvo-meter-gate', style: { left: `${gateThresholdPercent}%` }, title: `${gateDbVal} dB` }) : null,
   ),
   h('span', { style: { fontSize: '11px', fontVariantNumeric: 'tabular-nums', width: '32px', textAlign: 'right' } }, `${testLevel}%`),
   ) : null,
   h('div', { className: 'cb-row', style: { marginTop: '6px' } },
   h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', minWidth: '120px' } }, t('noiseGate') + ':'),
   h('select', {
    value: String(gateDbVal), disabled: !writable,
    onChange: (e) => setTop('noiseGateDb', Number(e.target.value)),
    style: { flex: 1 },
   },
    h('option', { value: '-999' }, t('noiseGateOff')),
    h('option', { value: '-50' }, '-50 dB (Low / Gentle)'),
    h('option', { value: '-45' }, '-45 dB (Standard Default)'),
    h('option', { value: '-35' }, '-35 dB (Medium Room)'),
    h('option', { value: '-25' }, '-25 dB (High / Mechanical Clicks)'),
    !['-999', '-50', '-45', '-35', '-25'].includes(String(gateDbVal)) ? h('option', { value: String(gateDbVal) }, `${gateDbVal} dB (${t('calibratedValue') || 'Calibrated'})`) : null,
   ),
   ),
   h('span', { className: 'dvs-sub' }, t('noiseGateHint')),
  ),
  h('div', { className: 'cb-field' },
   h('label', null, t('vadEngine')),
   h('select', {
    value: (draft && draft.vadEngine) || 'silero', disabled: !writable,
    onChange: (e) => setTop('vadEngine', e.target.value),
   },
    h('option', { value: 'silero' }, t('vadSilero')),
    h('option', { value: 'amplitude' }, t('vadAmplitude')),
   ),
   h('span', { className: 'dvs-sub' }, t('vadEngineHint')),
  ),
  h('div', { className: 'cb-field' },
   h('label', { className: 'cb-check-label' },
    h('input', {
     type: 'checkbox', checked: draft && draft.streamingWs !== false, disabled: !writable,
     onChange: (e) => setTop('streamingWs', e.target.checked),
    }),
    ' ' + t('streamingWs'),
   ),
   h('span', { className: 'dvs-sub' }, t('streamingWsHint')),
  ),
  // Endpoint text fields
  h('div', { className: 'cb-grid-2' },
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
  // Engine checkboxes
  h('div', { className: 'cb-row' },
   h('label', { className: 'cb-check-label' },
   h('input', {
    type: 'checkbox', checked: !!(draft && draft.autoStart), disabled: !writable,
    onChange: (e) => setTop('autoStart', e.target.checked),
   }),
   t('whisperAutostart'),
   ),
   h('label', { className: 'cb-check-label' },
   h('input', {
    type: 'checkbox', checked: !!(draft && draft.sensevoiceAutostart), disabled: !writable,
    onChange: (e) => setTop('sensevoiceAutostart', e.target.checked),
   }),
   t('sensevoiceAutostart'),
   ),
   h('label', { className: 'cb-check-label' },
   h('input', {
    type: 'checkbox', checked: !!(draft && draft.localOnly), disabled: !writable,
    onChange: (e) => setTop('localOnly', e.target.checked),
   }),
   t('localOnly'),
   ),
   h('label', { className: 'cb-check-label' },
   h('input', {
    type: 'checkbox', checked: !!(draft && draft.beep), disabled: !writable,
    onChange: (e) => setTop('beep', e.target.checked),
   }),
   t('beep'),
   ),
   h('label', { className: 'cb-check-label' },
   h('input', {
    type: 'checkbox', checked: draft ? draft.noiseSuppression !== false : true, disabled: !writable,
    onChange: (e) => setTop('noiseSuppression', e.target.checked),
   }),
   t('noiseSuppression'),
   ),
   h('label', { className: 'cb-check-label' },
   h('input', {
    type: 'checkbox', checked: draft ? draft.contextGlossary !== false : true, disabled: !writable,
    onChange: (e) => setTop('contextGlossary', e.target.checked),
   }),
   t('contextGlossary'),
   ),
   h('label', { className: 'cb-check-label', title: t('bilingualDeveloperPromptHint') || '' },
   h('input', {
    type: 'checkbox', checked: draft ? draft.bilingualDeveloperPrompt !== false : true, disabled: !writable,
    onChange: (e) => setTop('bilingualDeveloperPrompt', e.target.checked),
   }),
   t('bilingualDeveloperPrompt'),
   ),
   h('label', { className: 'cb-check-label' },
   h('input', {
    type: 'checkbox', checked: !!(draft && draft.voiceCommands), disabled: !writable,
    onChange: (e) => setTop('voiceCommands', e.target.checked),
   }),
   t('voiceCommandsLabel'),
   ),
   h('label', { className: 'cb-check-label' },
   h('input', {
    type: 'checkbox', checked: !!(draft && draft.normalizeTranscript), disabled: !writable,
    onChange: (e) => setTop('normalizeTranscript', e.target.checked),
   }),
   t('normalizeTranscript'),
   ),
  ),
  // Visualizer select
  h('div', { className: 'cb-field' },
   h('label', null, t('visualizerStyle')),
   h('select', {
   value: String((draft && draft.visualizerStyle) || 'liquid-wave'), disabled: !writable,
   onChange: (e) => setTop('visualizerStyle', e.target.value),
   },
   h('option', { value: 'liquid-wave' }, t('visLiquidWave')),
   h('option', { value: 'dynamic-orb' }, t('visDynamicOrb')),
   h('option', { value: 'bars' }, t('visBars')),
   h('option', { value: 'off' }, t('visOff')),
   ),
  ),
  // Hardware Acceleration (SBC NPU / Host)
  h('div', { className: 'cb-field' },
   h('label', null, t('npuProvider')),
   h('div', { className: 'cb-row' },
   h('select', {
    value: String((draft && draft.sensevoiceProvider) || 'cpu'),
    disabled: !writable,
    onChange: (e) => setTop('sensevoiceProvider', e.target.value),
    style: { flex: 1 },
   },
    h('option', { value: 'cpu' }, 'CPU (Standard)'),
    h('option', { value: 'rknn' }, 'Rockchip RK3588 NPU (RKNN)'),
    h('option', { value: 'coreml' }, 'Apple Silicon CoreML'),
    h('option', { value: 'openvino' }, 'Intel OpenVINO'),
    h('option', { value: 'cuda' }, 'NVIDIA CUDA'),
   ),
   h('input', {
    type: 'number',
    min: 1,
    max: 32,
    value: Number((draft && draft.sensevoiceThreads) || 4),
    disabled: !writable,
    title: t('npuThreads'),
    style: { width: '80px' },
    onChange: (e) => setTop('sensevoiceThreads', Math.max(1, Math.min(32, Number(e.target.value) || 4))),
   }),
   ),
   h('span', { className: 'dvs-sub' }, t('npuProviderHint')),
  ),
  // Hardware Benchmark
  h('div', { className: 'cb-field' },
   h('div', { className: 'cb-row', style: { alignItems: 'center', justifyContent: 'space-between' } },
   h('label', { style: { marginBottom: 0 } }, t('benchmarkTitle')),
   h('button', {
    type: 'button', className: 'cb-btn cb-btn-secondary', style: { fontSize: '12px', padding: '4px 10px' },
    disabled: benchmarking || !writable, onClick: runBenchmark,
   }, benchmarking ? ('⏳ ' + t('benchmarking')) : ('⚡ ' + t('runBenchmarkBtn'))),
   ),
   benchmarkResult
   ? h('div', {
    style: { marginTop: '8px', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', backgroundColor: 'var(--dsw-alias-fill-quaternary)' }
    }, benchmarkResult.running
    ? `⚡ RTF: ${benchmarkResult.rtf}x · ${benchmarkResult.latencyMs}ms (${benchmarkResult.rating}) · ${String(benchmarkResult.provider || 'cpu').toUpperCase()} · Cores: ${benchmarkResult.cpuCores}`
    : `ℹ ${benchmarkResult.message || 'Offline'} (${benchmarkResult.cpuCores} cores, ${benchmarkResult.platform})`)
   : (benchmarkErr ? h('div', { style: { color: 'var(--dsw-alias-state-danger)', fontSize: '12px', marginTop: '4px' } }, benchmarkErr) : null),
   h('span', { className: 'dvs-sub' }, t('benchmarkHint')),
  ),
  // WebGPU Status Indicator
  h('div', { className: 'cb-field' },
   h('label', null, t('webgpuStatus')),
   h('div', {
   style: {
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    backgroundColor: 'var(--dsw-alias-fill-quaternary)',
    color: (typeof isWebGpuSupported === 'function' && isWebGpuSupported())
    ? 'var(--dsw-alias-state-success)'
    : 'var(--dsw-alias-label-secondary)'
   }
   }, (typeof isWebGpuSupported === 'function' && isWebGpuSupported())
    ? ('✓ ' + t('webgpuAvailable'))
    : ('ℹ ' + t('webgpuNotAvailable'))),
  ),
  // Vocabulary textarea
  h('div', { className: 'cb-field' },
   h('label', null, t('vocabulary')),
   h('textarea', {
   rows: 3, disabled: !writable,
   value: Array.isArray(draft && draft.vocabulary) ? draft.vocabulary.join('\n') : '',
   onChange: (e) => setTop('vocabulary', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean)),
   }),
  ),
   )
  }
