// ------------------------------------------------------------------ 43-preview
// Editable preview state machine, session pinning & UI component (#170).

function initPendingPreview(text, target, options = {}) {
  const autoMs = Number(options.autoSendMs) || 4000
  const polishedText = options.polishedText || text
  const isPolished = options.polishSend && polishedText && polishedText !== text
  const initialDraft = (target && typeof target.initialDraft === 'string')
    ? target.initialDraft
    : ((target && target.input && typeof target.input.draft === 'string') ? target.input.draft : '')
  const sessionId = (target && target.sessionId) || ''

  return {
    text,
    rawText: text,
    polishedText,
    activeText: isPolished ? polishedText : text,
    selectedTab: isPolished ? 'polished' : 'raw',
    isEditing: false,
    target,
    sessionId,
    initialDraft,
    totalMs: autoMs,
    leftMs: autoMs,
    paused: false,
    audioUrl: options.audioUrl || '',
    sessionMismatch: false,
  }
}

function cancelPendingPreview(voice) {
  const pending = voice.pending
  if (!pending) {
    voice.set({ phase: 'idle' })
    return
  }
  const target = pending.target || voice._activeTarget
  const actions = (target && target.actions) || voice.inputActions

  // Restore untouched composer draft if preview was active
  if (pending.rawText !== undefined && pending.initialDraft !== undefined) {
    if (actions && typeof actions.setDraft === 'function') {
      try { actions.setDraft(pending.initialDraft) } catch (_) {}
    }
  }
  voice.pending = null
  voice.set({ phase: 'idle' })
}

function keepPendingPreview(voice) {
  const pending = voice.pending
  if (!pending) {
    voice.set({ phase: 'idle' })
    return
  }
  const target = pending.target || voice._activeTarget
  const actions = (target && target.actions) || voice.inputActions

  if (pending.rawText !== undefined) {
    // Insert final edited text into composer draft without auto-sending
    const initial = pending.initialDraft || ''
    const textToInsert = pending.activeText || ''
    const full = initial
      ? (initial.endsWith(' ') || initial.endsWith('\n') ? (initial + textToInsert) : (initial + ' ' + textToInsert))
      : textToInsert
    if (actions && typeof actions.setDraft === 'function') {
      try { actions.setDraft(full) } catch (_) {}
    }
  }
  voice.pending = null
  voice.set({ phase: 'idle' })
}

function submitPendingPreview(voice) {
  const pending = voice.pending
  if (!pending) return
  const target = pending.target || voice._activeTarget
  const actions = (target && target.actions) || voice.inputActions

  // Session guard (#170): verify that current session matches initiating session
  const currentSessionId = (target && target.session && (target.session.sessionId || target.session.id))
    || (voice.session && (voice.session.sessionId || voice.session.id))
    || voice.currentSessionId || ''

  if (pending.sessionId && currentSessionId && pending.sessionId !== currentSessionId) {
    pending.sessionMismatch = true
    pending.paused = true
    voice.notify()
    return
  }

  const textToSend = (pending.rawText !== undefined ? pending.activeText : pending.text) || ''
  voice.pending = null
  voice.set({ phase: 'idle' })

  if (pending.rawText !== undefined) {
    const initial = pending.initialDraft || ''
    const full = initial
      ? (initial.endsWith(' ') || initial.endsWith('\n') ? (initial + textToSend) : (initial + ' ' + textToSend))
      : textToSend
    if (actions && typeof actions.setDraft === 'function') {
      try { actions.setDraft(full) } catch (_) {}
    }
    if (actions && typeof actions.submit === 'function') {
      try { actions.submit() } catch (_) {}
    }
  } else {
    // Legacy path without rich preview
    if (voice.settings.polishSend) {
      fetch('/dsh-voice/polish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: textToSend }),
      })
        .then((res) => res.json())
        .then((data) => {
          const polished = (data && data.text) || textToSend
          if (actions && typeof actions.setDraft === 'function') actions.setDraft(polished)
          if (actions && typeof actions.submit === 'function') actions.submit()
        })
        .catch(() => {
          if (actions && typeof actions.submit === 'function') actions.submit()
        })
    } else if (actions && typeof actions.submit === 'function') {
      actions.submit()
    }
  }
}

function renderEditablePreviewPill(voice, v, isPlaying, setIsPlaying, audioRef) {
  const p = voice.pending
  const total = p.totalMs || Number(voice.settings.autoSendMs) || 4000
  const leftMs = Math.max(0, p.leftMs || 0)
  const left = Math.ceil(leftMs / 1000)
  const frac = total > 0 ? Math.max(0, Math.min(1, leftMs / total)) : 0
  const circ = 2 * Math.PI * 14
  const off = circ * (1 - frac)
  const hasPolish = p.polishedText && p.polishedText !== p.rawText

  return h('div', { className: 'dvo-pill-preview', role: 'region', 'aria-label': t('editablePreview') },
    // Header row: tabs, audio playback, status/countdown, cancel button
    h('div', { className: 'dvo-preview-header' },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        hasPolish
          ? h('div', { className: 'dvo-preview-tabs' },
              h('button', {
                type: 'button',
                className: 'dvo-tab-btn' + (p.selectedTab === 'raw' ? ' dvo-tab-btn-active' : ''),
                onClick: () => {
                  p.selectedTab = 'raw'
                  p.activeText = p.rawText
                  voice.notify()
                },
              }, t('rawText')),
              h('button', {
                type: 'button',
                className: 'dvo-tab-btn' + (p.selectedTab === 'polished' ? ' dvo-tab-btn-active' : ''),
                onClick: () => {
                  p.selectedTab = 'polished'
                  p.activeText = p.polishedText
                  voice.notify()
                },
              }, t('polishedText')),
            )
          : h('span', { className: 'dvo-count' }, t('rawText')),
        p.audioUrl
          ? h('div', { className: 'dvo-audio-wrap' },
              h('button', {
                type: 'button', className: 'dvo-audio-play',
                title: isPlaying ? t('pause') : t('play'),
                'aria-label': isPlaying ? t('pause') : t('play'),
                onClick: () => {
                  const el = audioRef.current
                  if (!el) return
                  if (el.paused) { el.play().catch(() => {}); setIsPlaying(true) }
                  else { el.pause(); setIsPlaying(false) }
                },
              }, isPlaying ? pauseIcon() : playIcon()),
              h('audio', {
                ref: audioRef, src: p.audioUrl,
                onEnded: () => setIsPlaying(false),
                onPause: () => setIsPlaying(false),
                onPlay: () => setIsPlaying(true),
              }),
              h('span', { className: 'dvo-audio-time' }, t('listenBack')),
            )
          : null,
      ),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        (!p.paused && !p.isEditing && v.settings.autoSendVisualRing !== false)
          ? h('svg', { className: 'dvo-silence-ring', viewBox: '0 0 34 34' },
              h('circle', { cx: 17, cy: 17, r: 14, className: 'dvo-ring-bg' }),
              h('circle', {
                cx: 17, cy: 17, r: 14, className: 'dvo-ring-fg',
                strokeDasharray: `${circ} ${circ}`,
                strokeDashoffset: off,
              }),
            )
          : null,
        h('span', { className: 'dvo-count' },
          (p.paused || p.isEditing) ? '' : (left + t('secondsShort'))
        ),
        h('button', {
          type: 'button', className: 'dvo-pbtn', title: t('cancelPreview'),
          'aria-label': t('cancelPreview'),
          onClick: () => { cancelPending(); focusComposer() },
        }, xIcon()),
      ),
    ),
    // Body row: editable input or preview text, Edit button, Send button
    h('div', { className: 'dvo-preview-body' },
      p.isEditing
        ? h('input', {
            type: 'text',
            className: 'dvo-preview-input',
            value: p.activeText,
            autoFocus: true,
            onChange: (e) => {
              p.activeText = e.target.value
              voice.notify()
            },
            onKeyDown: (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submitPending()
              }
            },
          })
        : h('span', { className: 'dvo-preview-text' }, p.activeText),
      !p.isEditing
        ? h('button', {
            type: 'button', className: 'dvo-pbtn', title: t('editPreview'),
            'aria-label': t('editPreview'),
            onClick: () => {
              p.isEditing = true
              p.paused = true
              voice.notify()
            },
          }, editIcon())
        : null,
      h('button', {
        type: 'button', className: 'dvo-btn-send', title: t('sendNow'),
        'aria-label': t('sendNow'),
        onClick: () => { submitPending(); focusComposer() },
      }, sendIcon()),
    ),
    // Mismatch warning banner
    p.sessionMismatch
      ? h('div', { className: 'dvo-warn-banner' }, t('sessionMismatch'))
      : null,
  )
}
