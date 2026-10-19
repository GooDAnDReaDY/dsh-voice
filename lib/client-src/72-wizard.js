  // ------------------------------------------------------- first-run wizard (#265)
  function FirstRunWizard(props) {
   const t = props.t || moduleT
   const draft = props.draft
   const setTop = props.setTop
   const writable = props.writable
   const onClose = props.onClose

   const isSecure = typeof window !== 'undefined' ? (window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') : true
   const hasMediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'
   const hasMediaRecorder = typeof MediaRecorder !== 'undefined'

   const [micPermission, setMicPermission] = React.useState('prompt')
   const [devices, setDevices] = React.useState([])
   const [selectedDev, setSelectedDev] = React.useState((draft && draft.micDeviceId) || '')
   const [signalTesting, setSignalTesting] = React.useState(false)
   const [currentRms, setCurrentRms] = React.useState(0)
   const [peakRms, setPeakRms] = React.useState(0)
   const [testingStt, setTestingStt] = React.useState(false)
   const [testCountdown, setTestCountdown] = React.useState(0)
   const [testResult, setTestResult] = React.useState(null)
   const [testError, setTestError] = React.useState('')
   const [testLatency, setTestLatency] = React.useState(null)

   const signalStreamRef = React.useRef(null)
   const audioCtxRef = React.useRef(null)
   const animFrameRef = React.useRef(null)

   React.useEffect(() => {
  if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
   navigator.permissions.query({ name: 'microphone' })
   .then((p) => {
    if (p) {
    setMicPermission(p.state)
    p.onchange = () => setMicPermission(p.state)
    }
   })
   .catch(() => {})
  }
   }, [])

   const refreshDevices = () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return
  navigator.mediaDevices.enumerateDevices()
   .then((list) => {
   const audioInputs = list.filter((d) => d.kind === 'audioinput')
   setDevices(audioInputs)
   })
   .catch(() => {})
   }

   React.useEffect(() => {
  refreshDevices()
   }, [])

   const stopSignalTest = () => {
  if (animFrameRef.current) {
   cancelAnimationFrame(animFrameRef.current)
   animFrameRef.current = null
  }
  if (signalStreamRef.current) {
   try { signalStreamRef.current.getTracks().forEach((trk) => trk.stop()) } catch (_) {}
   signalStreamRef.current = null
  }
  if (audioCtxRef.current) {
   try { audioCtxRef.current.close() } catch (_) {}
   audioCtxRef.current = null
  }
  setSignalTesting(false)
  setCurrentRms(0)
   }

   React.useEffect(() => {
  return () => {
   stopSignalTest()
  }
   }, [])

   const requestPermissionAndTestSignal = async () => {
  stopSignalTest()
  setTestError('')
  try {
   const constraints = {
   audio: selectedDev ? { deviceId: { exact: selectedDev } } : true,
   }
   const stream = await navigator.mediaDevices.getUserMedia(constraints)
   signalStreamRef.current = stream
   setMicPermission('granted')
   refreshDevices()

   const AC = typeof AudioContext !== 'undefined' ? AudioContext
   : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null)
   if (!AC) return
   const actx = new AC()
   audioCtxRef.current = actx
   if (actx.state === 'suspended') { actx.resume().catch(() => {}) }
   const src = actx.createMediaStreamSource(stream)
   const analyser = actx.createAnalyser()
   analyser.fftSize = 128
   src.connect(analyser)

   setSignalTesting(true)
   const buf = new Uint8Array(analyser.frequencyBinCount)

   const checkLevel = () => {
   if (!signalStreamRef.current) return
   analyser.getByteFrequencyData(buf)
   let sum = 0
   for (let i = 0; i < buf.length; i++) sum += buf[i]
   const rms = Math.min(100, Math.round((sum / buf.length / 255) * 100 * 2.2))
   setCurrentRms(rms)
   setPeakRms((prev) => Math.max(prev, rms))
   animFrameRef.current = requestAnimationFrame(checkLevel)
   }
   animFrameRef.current = requestAnimationFrame(checkLevel)
  } catch (err) {
   setMicPermission('denied')
   setTestError(String(err && err.message ? err.message : err))
   stopSignalTest()
  }
   }

   const runSttTest = async () => {
  stopSignalTest()
  setTestError('')
  setTestResult(null)
  setTestLatency(null)
  setTestingStt(true)
  setTestCountdown(3)

  let testStream = null
  let recorder = null
  const chunks = []

  try {
   const constraints = {
   audio: selectedDev ? { deviceId: { exact: selectedDev } } : true,
   }
   testStream = await navigator.mediaDevices.getUserMedia(constraints)
   let mime = 'audio/webm;codecs=opus'
   if (!MediaRecorder.isTypeSupported(mime)) mime = ''
   recorder = mime ? new MediaRecorder(testStream, { mimeType: mime }) : new MediaRecorder(testStream)
   recorder.ondataavailable = (e) => {
   if (e.data && e.data.size > 0) chunks.push(e.data)
   }
   recorder.start()

   let left = 3
   const countdownTimer = setInterval(() => {
   left -= 1
   setTestCountdown(left)
   if (left <= 0) {
    clearInterval(countdownTimer)
    if (recorder.state !== 'inactive') recorder.stop()
   }
   }, 1000)

   await new Promise((resolve) => recorder.addEventListener('stop', resolve, { once: true }))

   try { testStream.getTracks().forEach((trk) => trk.stop()) } catch (_) {}

   const blob = new Blob(chunks, { type: mime || 'audio/webm' })
   if (blob.size < 400) {
   setTestError(t('wizardTestEmpty'))
   setTestingStt(false)
   return
   }

   setTestCountdown(0)
   const startMs = Date.now()
   const dataBase64 = await blobToBase64(blob)
   const payload = {
   dataBase64,
   mimeType: mime || recorder.mimeType || 'audio/webm',
   mode: 'dictation',
   subMode: 'clean',
   }

   const res = await fetch('/dsh-voice/transcribe', {
   method: 'POST',
   headers: { 'content-type': 'application/json' },
   body: JSON.stringify(payload),
   })
   const data = await res.json()
   const latency = Date.now() - startMs
   setTestLatency(latency)

   if (!res.ok || !data || !data.ok) {
   const msg = (data && data.error && data.error.message) || `HTTP ${res.status}`
   setTestError(msg)
   } else {
   const recognized = String(data.text || '').trim()
   if (recognized) {
    setTestResult(recognized)
    if (typeof setTop === 'function') {
    setTop('wizardCompleted', true)
    }
   } else {
    setTestError(t('wizardTestEmpty'))
   }
   }
  } catch (err) {
   setTestError(String(err && err.message ? err.message : err))
  } finally {
   if (testStream) {
   try { testStream.getTracks().forEach((trk) => trk.stop()) } catch (_) {}
   }
   setTestingStt(false)
  }
   }

   // Determine active chain info
   const dictationChain = (draft && draft.dictation && draft.dictation.chain) || []
   const activeProvider = (dictationChain[0] && (dictationChain[0].provider || dictationChain[0])) || 'sensevoice'
   let areaLabel = t('wizardAreaServer')
   if (activeProvider === 'browser' || activeProvider === 'browser-webgpu') {
  areaLabel = t('wizardAreaBrowser')
   } else if (activeProvider !== 'sensevoice' && activeProvider !== 'local-whisper') {
  areaLabel = t('wizardAreaCloud')
   }

   let nextStepHint = ''
   if (!isSecure) {
  nextStepHint = t('wizardHintHttps')
   } else if (micPermission === 'denied') {
  nextStepHint = t('wizardHintPermission')
   } else if (peakRms === 0 && signalTesting) {
  nextStepHint = t('wizardHintDevice')
   } else if (testError) {
  nextStepHint = t('wizardHintProvider')
   }

   return React.createElement('div', { className: 'cb-section-card', style: { borderColor: 'var(--dsw-alias-state-brand-primary)' } },
  React.createElement('div', { className: 'cb-section-title' },
   React.createElement('span', null, '✨ ' + t('wizardTitle')),
   React.createElement('div', { style: { display: 'flex', gap: '8px' } },
   testResult ? React.createElement('span', { className: 'cb-badge cb-badge-ok' }, '✓ ' + t('wizardStatusCompleted')) : null,
   onClose ? React.createElement('button', {
    type: 'button', className: 'cb-btn cb-btn-mini', onClick: onClose, title: t('wizardClose'),
   }, '✕') : null,
   ),
  ),
  React.createElement('div', { className: 'cb-section-desc' }, t('wizardDesc')),

  // Step 1: Environment & Permissions
  React.createElement('div', { className: 'dvs-card' },
   React.createElement('div', { className: 'dvs-h' }, t('wizardStep1')),
   React.createElement('div', { className: 'cb-row' },
   React.createElement('span', { className: 'cb-badge ' + (isSecure ? 'cb-badge-ok' : 'cb-badge-err') },
    isSecure ? ('✓ ' + t('wizardSecureContextOk')) : ('✗ ' + t('wizardSecureContextBad'))
   ),
   React.createElement('span', { className: 'cb-badge ' + (hasMediaDevices ? 'cb-badge-ok' : 'cb-badge-err') },
    hasMediaDevices ? ('✓ ' + t('wizardMediaDevicesOk')) : ('✗ ' + t('wizardMediaDevicesBad'))
   ),
   React.createElement('span', { className: 'cb-badge ' + (hasMediaRecorder ? 'cb-badge-ok' : 'cb-badge-err') },
    hasMediaRecorder ? ('✓ ' + t('wizardMediaRecorderOk')) : ('✗ ' + t('wizardMediaRecorderBad'))
   ),
   React.createElement('span', { className: 'cb-badge ' + (micPermission === 'granted' ? 'cb-badge-ok' : (micPermission === 'denied' ? 'cb-badge-err' : 'cb-badge-warn')) },
    micPermission === 'granted' ? ('✓ ' + t('wizardMicPermissionOk')) : (micPermission === 'denied' ? ('✗ ' + t('wizardMicPermissionBad')) : ('· ' + t('wizardMicPermissionPrompt')))
   ),
   ),
   React.createElement('div', { className: 'cb-field', style: { marginTop: '8px' } },
   React.createElement('label', null, t('wizardMicLabel')),
   React.createElement('div', { className: 'cb-row' },
    React.createElement('select', {
    value: selectedDev,
    style: { flex: 1, minWidth: '240px' },
    onChange: (e) => {
     setSelectedDev(e.target.value)
     if (typeof setTop === 'function') setTop('micDeviceId', e.target.value)
     stopSignalTest()
    },
    },
    React.createElement('option', { value: '' }, 'Default System Microphone'),
    devices.map((d) => React.createElement('option', { key: d.deviceId, value: d.deviceId }, d.label || `Microphone ${d.deviceId.slice(0, 8)}…`))
    ),
    React.createElement('button', {
    type: 'button',
    className: 'cb-btn',
    onClick: requestPermissionAndTestSignal,
    }, t('wizardRequestMic')),
   ),
   ),
  ),

  // Step 2: Live Audio Signal Test
  React.createElement('div', { className: 'dvs-card' },
   React.createElement('div', { className: 'dvs-h' }, t('wizardStep2')),
   React.createElement('div', { className: 'cb-row', style: { alignItems: 'center' } },
   React.createElement('button', {
    type: 'button',
    className: 'cb-btn ' + (signalTesting ? 'cb-btn-danger' : 'cb-btn-primary'),
    onClick: signalTesting ? stopSignalTest : requestPermissionAndTestSignal,
   }, signalTesting ? t('wizardStopSignalCheck') : t('wizardStartSignalCheck')),
   signalTesting ? React.createElement('span', { className: 'dvs-sub' }, t('wizardSignalTesting')) : null,
   ),
   signalTesting ? React.createElement('div', { style: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' } },
   React.createElement('div', {
    style: {
    height: '14px',
    borderRadius: '7px',
    background: 'var(--dsw-alias-bg-layer-1)',
    border: '1px solid var(--dsw-alias-border-l1)',
    overflow: 'hidden',
    position: 'relative',
    },
   },
    React.createElement('div', {
    style: {
     width: `${currentRms}%`,
     height: '100%',
     background: currentRms > 5 ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-dimmed)',
     transition: 'width 0.05s linear',
    },
    }),
   ),
   React.createElement('span', { className: currentRms > 5 ? 'dvs-ok' : 'dvs-sub' },
    currentRms > 5
    ? t('wizardSignalOk').replace('{level}', currentRms)
    : t('wizardSignalZero')
   ),
   ) : null,
  ),

  // Step 3: Transcription Round-Trip Test
  React.createElement('div', { className: 'dvs-card' },
   React.createElement('div', { className: 'dvs-h' }, t('wizardStep3')),
   React.createElement('div', { className: 'cb-row' },
   React.createElement('span', { className: 'dvs-sub' }, `${t('wizardProviderLabel')} ${activeProvider}`),
   React.createElement('span', { className: 'cb-badge' }, `${t('wizardProcessingArea')} ${areaLabel}`),
   ),
   React.createElement('div', { className: 'cb-row', style: { marginTop: '8px' } },
   React.createElement('button', {
    type: 'button',
    className: 'cb-btn cb-btn-primary',
    disabled: testingStt || micPermission === 'denied',
    onClick: runSttTest,
   }, testingStt
    ? (testCountdown > 0 ? t('wizardRecordingTest').replace('{left}', testCountdown) : t('wizardTranscribingTest'))
    : t('wizardStartTestRecord')
   ),
   ),
   testResult ? React.createElement('div', { style: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' } },
   React.createElement('div', { className: 'dvs-ok' },
    '✓ ' + t('wizardTestSuccess').replace('{latency}', testLatency || 0)
   ),
   React.createElement('blockquote', {
    style: {
    margin: '4px 0 0 0',
    padding: '8px 12px',
    borderRadius: '6px',
    background: 'var(--dsw-alias-bg-layer-3)',
    borderLeft: '4px solid var(--dsw-alias-state-success-primary)',
    color: 'var(--dsw-alias-label-primary)',
    fontStyle: 'italic',
    },
   }, `“${testResult}”`),
   ) : null,
   testError ? React.createElement('div', { className: 'cb-alert-err', style: { marginTop: '8px' } },
   t('wizardTestFailed').replace('{error}', testError)
   ) : null,
  ),

  // Next Step Hint / Feedback
  nextStepHint ? React.createElement('div', { className: 'dvs-wait', style: { fontStyle: 'italic' } },
   t('wizardNextStepHint').replace('{hint}', nextStepHint)
  ) : null,

  // Wizard Bottom Actions
  React.createElement('div', { className: 'cb-row', style: { justifyContent: 'space-between', marginTop: '6px' } },
   React.createElement('button', {
   type: 'button',
   className: 'cb-btn',
   onClick: () => {
    if (typeof setTop === 'function') setTop('wizardCompleted', true)
    if (onClose) onClose()
   },
   }, t('wizardSkip')),
   testResult ? React.createElement('button', {
   type: 'button',
   className: 'cb-btn cb-btn-primary',
   onClick: () => {
    if (typeof setTop === 'function') setTop('wizardCompleted', true)
    if (onClose) onClose()
   },
   }, '✓ ' + t('wizardFinishSuccess')) : null,
  ),
   )
  }
