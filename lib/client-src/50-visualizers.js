    // ----------------------------------------------------------- visualizers
    function accentColor(fallback) {
      try {
        const root = document.documentElement
        const s = getComputedStyle(root)
        const pick = s.getPropertyValue('--dsw-alias-state-info-primary').trim()
          || s.getPropertyValue('--dsw-alias-label-primary').trim()
        if (pick) return pick
      } catch (noTheme) { /* canvas-only fallback */ }
      return fallback || voice.waveColor || 'currentColor'
    }
    function softColor(fallback) {
      try {
        const s = getComputedStyle(document.documentElement)
        const pick = s.getPropertyValue('--dsw-alias-bg-layer-3').trim()
          || s.getPropertyValue('--dsw-alias-label-primary').trim()
        if (pick) return pick
      } catch (noTheme) { /* fallback */ }
      return fallback || voice.waveColor || 'currentColor'
    }
    // 1. Liquid Wave: organic multi-layer wave
    function drawLiquidWave(g, w, h, levels, color, time) {
      const midY = h / 2
      const curLevel = levels.length ? levels[levels.length - 1] : 0
      const smoothLevel = Math.max(0.04, Math.min(1, curLevel * 1.6))

      const layers = [
        { amp: smoothLevel * (h * 0.42), freq: 0.024, speed: 0.08, alpha: 0.45 },
        { amp: smoothLevel * (h * 0.36), freq: 0.038, speed: -0.06, alpha: 0.75 },
        { amp: smoothLevel * (h * 0.28), freq: 0.052, speed: 0.11, alpha: 0.95 },
      ]

      for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
        const lyr = layers[layerIdx]
        g.beginPath()
        g.globalAlpha = lyr.alpha

        const grad = g.createLinearGradient(0, 0, w, 0)
        grad.addColorStop(0, color)
        grad.addColorStop(0.5, accentColor(color))
        grad.addColorStop(1, color)
        g.strokeStyle = grad
        g.lineWidth = layerIdx === 2 ? 2.5 : 1.5

        g.moveTo(0, midY)
        const step = 6
        for (let x = 0; x <= w; x += step) {
          const edgeDist = Math.min(x, w - x) / (w * 0.25)
          const envelope = Math.min(1, Math.max(0, edgeDist))
          const phase = time * lyr.speed + x * lyr.freq
          const dy = Math.sin(phase) * lyr.amp * envelope + Math.cos(phase * 0.5) * (lyr.amp * 0.35) * envelope
          g.lineTo(x, midY + dy)
        }
        g.stroke()
      }
      g.globalAlpha = 1
    }

    // 2. Dynamic Orb: interactive pulsing sphere in the center
    function drawDynamicOrb(g, w, h, levels, color, time) {
      const cx = w / 2
      const cy = h / 2
      const curLevel = levels.length ? levels[levels.length - 1] : 0
      const smoothLevel = Math.max(0.05, Math.min(1, curLevel * 2.0))

      g.beginPath()
      g.globalAlpha = 0.25
      g.strokeStyle = color
      g.lineWidth = 1
      g.moveTo(10, cy)
      g.lineTo(cx - 35, cy)
      g.moveTo(cx + 35, cy)
      g.lineTo(w - 10, cy)
      g.stroke()

      const rRing = 14 + smoothLevel * 14 + Math.sin(time * 0.08) * 3
      g.beginPath()
      g.arc(cx, cy, rRing, 0, Math.PI * 2)
      g.strokeStyle = accentColor(color)
      g.globalAlpha = 0.35 + smoothLevel * 0.4
      g.lineWidth = 1.5
      g.stroke()

      if (smoothLevel > 0.25) {
        g.beginPath()
        g.arc(cx, cy, rRing + 7 + Math.cos(time * 0.06) * 4, 0, Math.PI * 2)
        g.strokeStyle = color
        g.globalAlpha = 0.2 + smoothLevel * 0.3
        g.lineWidth = 1
        g.stroke()
      }

      const rCore = 6 + smoothLevel * 8 + Math.sin(time * 0.12) * 1.5
      const radial = g.createRadialGradient(cx, cy, 1, cx, cy, rCore + 4)
      radial.addColorStop(0, softColor(color))
      radial.addColorStop(0.4, accentColor(color))
      radial.addColorStop(1, color)
      g.beginPath()
      g.arc(cx, cy, rCore, 0, Math.PI * 2)
      g.fillStyle = radial
      g.globalAlpha = 0.95
      g.fill()

      g.globalAlpha = 1
    }

    // 3. Classic Bars: classic vertical bars
    function drawClassicBars(g, w, h, levels, color) {
      const midY = h / 2
      for (let i = 0; i < levels.length && i * 7 < w; i++) {
        const level = levels[levels.length - 1 - i]
        const age = i / levels.length
        const x = w - 10 - i * 7
        const hh = Math.max(2.5, level * (h - 6) * 0.5 * (1 - age * 0.35))
        g.globalAlpha = 1 - age * 0.75
        g.fillStyle = color
        g.fillRect(x, midY - hh, 3.5, hh * 2)
      }
      g.globalAlpha = 1
    }

