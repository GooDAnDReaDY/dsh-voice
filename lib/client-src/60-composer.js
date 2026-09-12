    function RecordPill(props) {
      const v = useVoice()
      const canvasRef = React.useRef(null)
      const audioRef = React.useRef(null)
      const [isPlaying, setIsPlaying] = React.useState(false)
      voice.inputActions = props.inputActions
      voice.input = props.input
      const ctx = props.ctx

      // VAD: accumulate silence and cut the phrase when the pause exceeds the threshold.
      React.useEffect(() => {
        if (v.phase !== 'recording') return
        const tick = 50
        const dispose = ctx.interval(() => {
          const rec = voice.rec
          if (!rec) return
          const level = currentLevel(rec)
          voice.levels.push(level)
          if (voice.levels.length > 150) voice.levels.shift()
          if (level > 0.06) { rec.hadSpeech = true; rec.silenceMs = 0 }
          else if (rec.hadSpeech) rec.silenceMs += tick
          const speaking = level > 0.06
          if (voice.speaking !== speaking) { voice.speaking = speaking; voice.notify() }
          const adapt = Number(voice.settings.vadAdapt) || 0
          let effectiveVad = Number(voice.settings.vadSilenceMs) || 700
          if (adapt > 0 && rec.hadSpeech) {
            // Adaptive threshold (#41): speech density over ~1s (20 samples).
            // Dense speech -> lower threshold (cut more precisely);
            // pause-heavy -> threshold rises toward base (do not cut on breaths).
            const win = voice.levels.slice(-20)
            const density = win.length ? win.filter((v) => v > 0.06).length / win.length : 0
            const k = adapt * (density - 0.5) * 2
            effectiveVad = Math.max(150, Math.round(Number(voice.settings.vadSilenceMs) * (1 - k)))
          }
          // Continuous mode (#40): cut on a timer while speech continues,
          // without waiting for a long pause.
          const stream = !!voice.settings.stream && rec.mode === 'dictation'
          if (stream && rec.hadSpeech && !rec.cutting) {
            rec.streamMs += tick
            const chunk = Number(voice.settings.streamChunkMs) || 1200
            if (rec.streamMs >= chunk) { cutPhrase(); return }
          } else {
            rec.streamMs = 0
          }
          if (rec.mode === 'dictation' && rec.hadSpeech && rec.silenceMs >= effectiveVad) {
            rec.streamMs = 0
            cutPhrase()
          }
        }, tick)
        return () => dispose()
      }, [v.phase])

      // Waveform / visualizer animation: requestAnimationFrame with HiDPI scaling
      React.useEffect(() => {
        if (v.phase !== 'recording') return
        let frame = 0
        let animId = null
        let running = true

        const render = () => {
          if (!running) return
          const canvas = canvasRef.current
          if (canvas) {
            const g = canvas.getContext('2d')
            const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
            const rect = canvas.getBoundingClientRect()
            const cssW = rect.width || 720
            const cssH = rect.height || 40
            const targetW = Math.max(1, Math.round(cssW * dpr))
            const targetH = Math.max(1, Math.round(cssH * dpr))

            if (canvas.width !== targetW || canvas.height !== targetH) {
              canvas.width = targetW
              canvas.height = targetH
            }

            g.save()
            g.scale(dpr, dpr)
            g.clearRect(0, 0, cssW, cssH)

            if (!voice.waveColor) {
              try { voice.waveColor = getComputedStyle(canvas).color || '#fff' } catch (e) { voice.waveColor = '#fff' }
            }
            const levels = voice.levels
            const style = (voice.settings && voice.settings.visualizerStyle) || 'liquid-wave'
            frame++

            if (style === 'off') {
              g.beginPath()
              g.globalAlpha = 0.25
              g.strokeStyle = voice.waveColor
              g.lineWidth = 1
              g.moveTo(10, cssH / 2)
              g.lineTo(cssW - 10, cssH / 2)
              g.stroke()
              g.globalAlpha = 1
            } else if (style === 'dynamic-orb') {
              drawDynamicOrb(g, cssW, cssH, levels, voice.waveColor, frame)
            } else if (style === 'bars') {
              drawClassicBars(g, cssW, cssH, levels, voice.waveColor)
            } else {
              drawLiquidWave(g, cssW, cssH, levels, voice.waveColor, frame)
            }
            g.restore()
          }
          animId = requestAnimationFrame(render)
        }

        animId = requestAnimationFrame(render)
        return () => {
          running = false
          if (animId) cancelAnimationFrame(animId)
        }
      }, [v.phase])

      // Message-mode cancel window.
      React.useEffect(() => {
        if (v.phase !== 'pending') return
        const tick = 100
        const dispose = ctx.interval(() => {
          const p = voice.pending
          if (!p) return
          if (p.undoOnly) {
            // Undo-only mode (#29-5): when the window expires just hide the
            // panel; the text either stayed or was already undone.
            p.leftMs -= tick
            if (p.leftMs <= 0) voice.set({ phase: 'idle' })
            else voice.notify()
            return
          }
          p.leftMs -= tick
          if (p.leftMs <= 0) { submitPending(); return }
          voice.notify()
        }, tick)
        return () => dispose()
      }, [v.phase])

      if (v.phase === 'idle') {
        if (!voice.showPlayer || !voice.lastNote || !voice.lastNote.url) return null
        return React.createElement('div', { className: 'dvo-pill' },
          React.createElement('div', { className: 'dvo-audio-wrap' },
            React.createElement('button', {
              type: 'button', className: 'dvo-audio-play',
              title: isPlaying ? t('pause') : t('play'),
              onClick: () => {
                const el = audioRef.current
                if (!el) return
                if (el.paused) { el.play().catch(() => {}); setIsPlaying(true) }
                else { el.pause(); setIsPlaying(false) }
              },
            }, isPlaying ? pauseIcon() : playIcon()),
            React.createElement('audio', {
              ref: audioRef, src: voice.lastNote.url,
              onEnded: () => setIsPlaying(false),
              onPause: () => setIsPlaying(false),
              onPlay: () => setIsPlaying(true),
            }),
            React.createElement('span', { className: 'dvo-audio-time' }, t('lastRecording')),
          ),
          React.createElement('span', { className: 'dvo-status' }, voice.lastNote.text || ''),
          React.createElement('button', {
            type: 'button', className: 'dvo-pbtn', title: t('hide'),
            onClick: () => {
              if (audioRef.current) audioRef.current.pause()
              setIsPlaying(false)
              voice.set({ showPlayer: false })
            },
          }, xIcon()),
        )
      }

      if (v.phase === 'recording') {
        const inBrowser = !!voice.browser
        const rec = voice.rec
        const hint = v.mode === 'dictation' ? t('dictationPill') : t('messagePill')
        // Live caption of what is heard right now. Until the browser emits a
        // final chunk the text is interim and changes on screen.
        const caption = voice.caption || (inBrowser ? '' : null)
        return React.createElement('div', { className: 'dvo-pill' },
          React.createElement('button', { type: 'button', className: 'dvo-pbtn', title: t('cancel'), onClick: cancelCurrent }, xIcon()),
          inBrowser
            ? null
            : React.createElement('canvas', { className: 'dvo-wave', ref: canvasRef, width: 720, height: 40 }),
          React.createElement('span', { className: 'dvo-status' },
            caption
              ? caption
              : (voice.holding
                ? t('holdHint')
                : (inBrowser
                  ? t('listening')
                  : (rec && rec.hadSpeech ? (v.speaking ? t('speaking') : t('silence')) : hint)))),
          React.createElement('button', { type: 'button', className: 'dvo-pbtn', title: t('stop'), onClick: stopCurrent }, stopIcon()),
        )
      }

      if (v.phase === 'processing') {
        return React.createElement('div', { className: 'dvo-pill' },
          React.createElement('span', { className: 'dvo-status' }, spinIcon(), t('transcribing')))
      }

      if (v.phase === 'pending') {
        const left = Math.max(0, Math.ceil((voice.pending ? voice.pending.leftMs : 0) / 1000))
        if (voice.pending && voice.pending.undoOnly) {
          // Cancel window for delayed dictation insert (#29-5).
          return React.createElement('div', { className: 'dvo-pill' },
            React.createElement('span', { className: 'dvo-status' }, t('undo'), ': ', left, t('secondsShort')),
            React.createElement('button', {
              type: 'button', className: 'dvo-pbtn', title: t('undo'),
              onClick: async () => {
                const msg = await undoLastInsert()
                voice.set({ phase: 'idle', error: msg === t('undone') ? '' : msg })
              },
            }, xIcon()),
          )
        }
        return React.createElement('div', { className: 'dvo-pill' },
          voice.lastNote && voice.lastNote.url
            ? React.createElement('div', { className: 'dvo-audio-wrap' },
                React.createElement('button', {
                  type: 'button', className: 'dvo-audio-play',
                  title: isPlaying ? t('pause') : t('play'),
                  onClick: () => {
                    const el = audioRef.current
                    if (!el) return
                    if (el.paused) { el.play().catch(() => {}); setIsPlaying(true) }
                    else { el.pause(); setIsPlaying(false) }
                  },
                }, isPlaying ? pauseIcon() : playIcon()),
                React.createElement('audio', {
                  ref: audioRef, src: voice.lastNote.url,
                  onEnded: () => setIsPlaying(false),
                  onPause: () => setIsPlaying(false),
                  onPlay: () => setIsPlaying(true),
                }),
                React.createElement('span', { className: 'dvo-audio-time' }, t('listenBack')),
              )
            : null,
          React.createElement('span', { className: 'dvo-status' }, t('sendingIn')),
          React.createElement('span', { className: 'dvo-count' }, left + t('secondsShort')),
          React.createElement('button', { type: 'button', className: 'dvo-pbtn', title: t('keepPending'), onClick: keepPending }, xIcon()),
        )
      }

      return React.createElement('div', { className: 'dvo-pill' },
        React.createElement('span', { className: 'dvo-status dvo-err' }, warnIcon(), v.error),
        React.createElement('button', { type: 'button', className: 'dvo-pbtn', title: t('hide'), onClick: () => voice.set({ phase: 'idle', error: '' }) }, xIcon()),
      )
    }

    // --------------------------------------------------------------- slots
    function registerComposer(ctx) {
      // The hotkey lives for as long as the plugin is applied and can change
      // without restart: the settings card broadcasts and the composer reloads.
      ctx.effect(() => {
        let dispose = () => {}
        let alive = true

        const reload = () => {
          fetch('/dsh-voice/status', { cache: 'no-store' })
            .then((res) => res.json())
            .then((data) => {
              if (!alive) return
              dispose()
              dispose = () => {}
              const key = data && data.hotkey
              voice.hotkey = key || ''
              if (key) dispose = installHotkey(ctx, key, 'message')
              // The composer needs fresh settings without opening the card.
              Object.assign(voice.settings, {
                beep: !!(data && data.beep),
                micDeviceId: String((data && data.micDeviceId) || ''),
                historyLimit: Number(data && data.historyLimit),
                voiceCommands: !!(data && data.voiceCommands),
                sendDelayMs: Number(data && data.modes && data.modes.dictation && data.modes.dictation.sendDelayMs) || 0,
                stream: !!(data && data.modes && data.modes.dictation && data.modes.dictation.stream),
                streamChunkMs: Number(data && data.modes && data.modes.dictation && data.modes.dictation.streamChunkMs) || 1200,
                vadAdapt: Number(data && data.modes && data.modes.dictation && data.modes.dictation.vadAdapt) || 0,
                wakeWord: String((data && data.wakeWord) || ''),
                bargeIn: !!(data && data.bargeIn),
                polishSend: !!(data && data.modes && data.modes.message && data.modes.message.polishSend),
                sessionCommands: !!(data && data.modes && data.modes.message && data.modes.message.sessionCommands),
                noiseSuppression: data && data.noiseSuppression !== false,
                contextGlossary: data && data.contextGlossary !== false,
                visualizerStyle: (data && data.visualizerStyle) || 'liquid-wave',
              })
            })
            .catch(() => { /* no host hint — no hotkey */ })
        }

        reload()
        window.addEventListener('dsh-voice:settings-saved', reload)
        return () => {
          alive = false
          window.removeEventListener('dsh-voice:settings-saved', reload)
          dispose()
        }
      }, 'dsh-voice: hold hotkey')

      ctx.slots.inject('conversation.input.right', () => ctx.slots.register(
        { name: 'conversation.input.right', id: '@goodandready/dsh-voice', order: 6, label: () => t('title') },
        (props) => React.createElement(VoiceButtons, { input: props.input, inputActions: props.inputActions }),
      ))
      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
        { name: 'conversation.input.dock', id: 'dsh-voice-rec', order: 0, label: () => t('recordSlot') },
        (props) => React.createElement(RecordPill, { input: props.input, inputActions: props.inputActions, ctx: ctx }),
      ))
    }

