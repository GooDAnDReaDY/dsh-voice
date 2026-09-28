    // Custom hooks for VoiceSection modularity
    function useSensevoiceInstaller(fetchStatus) {
      const [sensevoiceState, setSensevoiceState] = React.useState(null)
      const [installingSensevoice, setInstallingSensevoice] = React.useState(false)

      const fetchSensevoice = () => {
        fetch('/dsh-voice/sensevoice-installer')
          .then((r) => r.json())
          .then((d) => {
            setSensevoiceState(d)
            setInstallingSensevoice(!!(d && d.installing))
          })
          .catch(() => {})
      }

      React.useEffect(() => {
        fetchSensevoice()
      }, [])

      const triggerInstallSensevoice = () => {
        setInstallingSensevoice(true)
        fetch('/dsh-voice/sensevoice-installer', {
          method: 'POST',
          headers: {
            'x-dsh-plugin-update': '1',
            'Content-Type': 'application/json',
          },
        })
          .then((r) => r.json())
          .then(() => {
            const timer = setInterval(() => {
              fetch('/dsh-voice/sensevoice-installer')
                .then((r) => r.json())
                .then((d) => {
                  setSensevoiceState(d)
                  if (!d.installing) {
                    clearInterval(timer)
                    setInstallingSensevoice(false)
                    if (typeof fetchStatus === 'function') fetchStatus()
                  }
                })
                .catch(() => clearInterval(timer))
            }, 2000)
          })
          .catch(() => setInstallingSensevoice(false))
      }

      return { sensevoiceState, installingSensevoice, triggerInstallSensevoice }
    }

    function useMicTester(draft, value, setErr) {
      const [testingMic, setTestingMic] = React.useState(false)
      const [testLevel, setTestLevel] = React.useState(0)
      const testRef = React.useRef(null)

      const toggleTestMic = async () => {
        if (testingMic) {
          if (testRef.current) {
            testRef.current.active = false
            try { testRef.current.stream.getTracks().forEach((t) => t.stop()) } catch (e) { /* already stopped */ }
            if (testRef.current.audioCtx) { try { testRef.current.audioCtx.close() } catch (e) { /* already closed */ } }
            testRef.current = null
          }
          setTestingMic(false)
          setTestLevel(0)
          return
        }
        try {
          const devId = (draft && draft.micDeviceId) || (value && value.micDeviceId) || ''
          const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          if (devId) audio.deviceId = { exact: devId }
          const stream = await navigator.mediaDevices.getUserMedia({ audio })
          const AC = typeof AudioContext !== 'undefined' ? AudioContext : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null)
          if (!AC) return
          const audioCtx = new AC()
          if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => {})
          const src = audioCtx.createMediaStreamSource(stream)
          let lastNode = src
          try {
            const filter = audioCtx.createBiquadFilter()
            filter.type = 'highpass'
            filter.frequency.value = 80
            filter.Q.value = 0.707
            src.connect(filter)
            lastNode = filter
          } catch (e) { /* filter fallback */ }
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 128
          lastNode.connect(analyser)
          testRef.current = { stream, audioCtx, analyser, active: true }
          setTestingMic(true)

          const check = () => {
            if (!testRef.current || !testRef.current.active) return
            const arr = new Uint8Array(analyser.frequencyBinCount)
            analyser.getByteFrequencyData(arr)
            let sum = 0
            for (let i = 0; i < arr.length; i++) sum += arr[i]
            const avg = sum / (arr.length || 1)
            setTestLevel(Math.min(100, Math.round((avg / 128) * 100)))
            requestAnimationFrame(check)
          }
          requestAnimationFrame(check)
        } catch (e) {
          if (typeof setErr === 'function') setErr(String(e && e.message ? e.message : e))
        }
      }

      React.useEffect(() => {
        return () => {
          if (testRef.current) {
            testRef.current.active = false
            try { testRef.current.stream.getTracks().forEach((t) => t.stop()) } catch (e) { /* already stopped */ }
            if (testRef.current.audioCtx) { try { testRef.current.audioCtx.close() } catch (e) { /* already closed */ } }
            testRef.current = null
          }
        }
      }, [])

      const gateDbVal = Number((draft && draft.noiseGateDb !== undefined) ? draft.noiseGateDb : (value && value.noiseGateDb !== undefined) ? value.noiseGateDb : -45)
      const gateThresholdPercent = gateDbVal <= -90 ? 0 : Math.min(100, Math.max(0, Math.round(((gateDbVal + 60) / 40) * 100)))

      return { testingMic, testLevel, toggleTestMic, gateDbVal, gateThresholdPercent }
    }

    function usePluginUpdater() {
      const [updaterStatus, setUpdaterStatus] = React.useState(null)
      const [updating, setUpdating] = React.useState(false)
      const [updaterMsg, setUpdaterMsg] = React.useState('')
      const [updaterLoading, setUpdaterLoading] = React.useState(false)

      const checkUpdater = React.useCallback(async () => {
        setUpdaterLoading(true)
        setUpdaterMsg('')
        try {
          const res = await fetch('/api/dsh-voice/update', {
            headers: { accept: 'application/json' },
            cache: 'no-store',
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          setUpdaterStatus(data)
        } catch (e) {
          /* best effort update check */
        } finally {
          setUpdaterLoading(false)
        }
      }, [])

      const onUpdateNow = async () => {
        if (updating) return
        setUpdating(true)
        setUpdaterMsg('')
        try {
          const res = await fetch('/api/dsh-voice/update', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-dsh-plugin-update': '1',
            },
            cache: 'no-store',
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok || data.ok === false) {
            throw new Error(data.error || `HTTP ${res.status}`)
          }
          setUpdaterMsg(data.message || 'Update completed successfully.')
          checkUpdater()
        } catch (err) {
          setUpdaterMsg(err && err.message ? err.message : String(err))
        } finally {
          setUpdating(false)
        }
      }

      return { updaterStatus, updating, updaterMsg, updaterLoading, checkUpdater, onUpdateNow }
    }
