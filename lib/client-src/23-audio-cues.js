let _ac = null
function playAudioCue(t, { enabled = true } = {}) {
  if (!enabled || typeof window === 'undefined') return
  try {
    const C = window.AudioContext || window.webkitAudioContext
    if (!C) return
    if (!_ac || _ac.state === 'closed') _ac = new C()
    if (_ac.state === 'suspended') _ac.resume().catch(() => {})
    const n = _ac.currentTime, o = _ac.createOscillator(), g = _ac.createGain()
    o.connect(g); g.connect(_ac.destination)
    if (t === 'start') {
      o.frequency.setValueAtTime(440, n); o.frequency.exponentialRampToValueAtTime(880, n + 0.035)
      g.gain.setValueAtTime(0.04, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.04)
      o.start(n); o.stop(n + 0.045)
    } else if (t === 'stop') {
      o.frequency.setValueAtTime(700, n); o.frequency.exponentialRampToValueAtTime(350, n + 0.035)
      g.gain.setValueAtTime(0.04, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.04)
      o.start(n); o.stop(n + 0.045)
    } else if (t === 'success') {
      o.type = 'triangle'; o.frequency.setValueAtTime(587.33, n); o.frequency.setValueAtTime(880, n + 0.02)
      g.gain.setValueAtTime(0.035, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.06)
      o.start(n); o.stop(n + 0.065)
    }
  } catch (_) {}
}
