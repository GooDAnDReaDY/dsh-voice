    // Human-readable key name.
    const KEY_LABELS = {
      Control: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Meta: 'Win',
      Escape: 'Esc',
    }

    function keyLabel(name) {
      if (!name) return t('keyUnset')
      if (typeof name === 'string' && name.includes('+')) {
        return name.split('+').map((p) => keyLabel(p)).join(' + ')
      }
      if (name === 'Space') return t('keySpace')
      if (KEY_LABELS[name]) return KEY_LABELS[name]
      // Drop the Key/Digit prefix from codes like KeyR and Digit5.
      return String(name).replace(/^Key/, '').replace(/^Digit/, '')
    }

    // What to store on key press. Pure modifiers are remembered by name:
    // left and right have different codes but the user means "either".
    // Supports combos like Control+Space or Alt+KeyV.
    function keyFromEvent(event) {
      if (!event) return ''
      const modifiers = []
      if (event.ctrlKey && event.key !== 'Control') modifiers.push('Control')
      if (event.altKey && event.key !== 'Alt') modifiers.push('Alt')
      if (event.shiftKey && event.key !== 'Shift') modifiers.push('Shift')
      if (event.metaKey && event.key !== 'Meta') modifiers.push('Meta')

      const main = ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)
        ? event.key
        : (event.code || event.key || '')

      if (modifiers.length > 0 && !['Control', 'Alt', 'Shift', 'Meta'].includes(main)) {
        return modifiers.concat(main).join('+')
      }
      return main
    }

    function hotkeyMatches(event, name) {
      if (!event || !name) return false
      if (typeof name === 'string' && name.includes('+')) {
        const parts = name.split('+')
        const main = parts[parts.length - 1]
        const needCtrl = parts.includes('Control')
        const needAlt = parts.includes('Alt')
        const needShift = parts.includes('Shift')
        const needMeta = parts.includes('Meta')
        if (needCtrl && !event.ctrlKey) return false
        if (needAlt && !event.altKey) return false
        if (needShift && !event.shiftKey) return false
        if (needMeta && !event.metaKey) return false
        return event.code === main || event.key === main
      }
      if (name === 'Control') return event.key === 'Control'
      if (name === 'Alt') return event.key === 'Alt'
      if (name === 'Shift') return event.key === 'Shift'
      if (name === 'Meta') return event.key === 'Meta'
      return event.code === name || event.key === name
    }

    function isAllowedInEditable(name) {
      if (!name) return false
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(name)) return true
      if (/^F\d{1,2}$/.test(name)) return true
      if (typeof name === 'string' && name.includes('+')) return true
      if (['Tab', 'Pause', 'ScrollLock', 'Insert'].includes(name)) return true
      return false
    }

    function isHotkeyRelease(event, name) {
      if (!event || !name) return false
      if (typeof name === 'string' && name.includes('+')) {
        const parts = name.split('+')
        if (event.code === parts[parts.length - 1] || event.key === parts[parts.length - 1]) return true
        for (let i = 0; i < parts.length - 1; i++) {
          if (event.key === parts[i] || event.code === parts[i]) return true
        }
        return false
      }
      return event.code === name || event.key === name
    }

    // Announce that the user started speaking.
    //
    // Playback should mute immediately: listening and talking at once is
    // impossible. There is no plugin-to-plugin API — this broadcasts a window
    // event that anyone may hear, so either side works alone.

// --------------------------------------------------------- hold gesture
    const HOLD_THRESHOLD_MS = 350
    const hold = { active: false, mode: null, startedAt: 0, armed: false }
    let activePointerCleanup = null
    function beginHold(mode, pointerEvent) {
      if (hold.armed || (voice.phase !== 'idle' && voice.phase !== 'error')) return
      hold.armed = true
      hold.mode = mode
      hold.startedAt = Date.now()
      hold.active = false
      if (pointerEvent?.target?.setPointerCapture && pointerEvent.pointerId !== undefined) {
        try { pointerEvent.target.setPointerCapture(pointerEvent.pointerId) } catch (e) {}
      }
      if (typeof window !== 'undefined') {
        if (activePointerCleanup) { try { activePointerCleanup() } catch (e) {} }
        const onUp = () => endHold(false)
        const onCancel = () => endHold(true)
        window.addEventListener('pointerup', onUp, { once: true })
        window.addEventListener('pointercancel', onCancel, { once: true })
        activePointerCleanup = () => {
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onCancel)
          activePointerCleanup = null
        }
      }
      voice.holding = false
      startRecording(mode)
      setTimeout(() => {
        if (hold.armed) {
          hold.active = true
          voice.holding = true
          voice.notify()
        }
      }, HOLD_THRESHOLD_MS)
    }
    function endHold(cancelled) {
      if (activePointerCleanup) { try { activePointerCleanup() } catch (e) {} }
      if (!hold.armed) return
      hold.armed = false
      voice.holding = false
      voice.notify()
      if (cancelled) cancelCurrent()
      else stopCurrent()
    }

    let activeHotkeyCleanup = null
    function clearGlobalHotkey() {
      if (typeof activeHotkeyCleanup === 'function') {
        try { activeHotkeyCleanup() } catch (_) { /* ignore */ }
        activeHotkeyCleanup = null
      }
      if (typeof window !== 'undefined' && typeof window.__dsh_voice_hotkey_cleanup === 'function') {
        try { window.__dsh_voice_hotkey_cleanup() } catch (_) { /* ignore */ }
        window.__dsh_voice_hotkey_cleanup = null
      }
    }
    voice.clearGlobalHotkey = clearGlobalHotkey
    function installHotkey(ctx, keyName, mode) {
      clearGlobalHotkey()
      if (typeof document === 'undefined' || !keyName) return () => {}
      const down = (event) => {
        if (event.repeat) return
        const target = event.target
        const isEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || (typeof target.getAttribute === 'function' && target.getAttribute('contenteditable') === 'true'))
        if (isEditable && !isAllowedInEditable(keyName)) return
        if (hotkeyMatches(event, keyName)) {
          event.preventDefault()
          event.stopPropagation()
          beginHold(mode)
        }
      }

      const up = (event) => {
        if (hold.armed && isHotkeyRelease(event, keyName)) {
          event.preventDefault()
          endHold(false)
        } else if (event.key === 'Escape' && hold.armed) {
          event.preventDefault()
          endHold(true)
        }
      }
      const blur = () => { if (hold.armed) endHold(true) }
      document.addEventListener('keydown', down, true)
      document.addEventListener('keyup', up, true)
      window.addEventListener('blur', blur)
      const cleanup = () => {
        document.removeEventListener('keydown', down, true)
        document.removeEventListener('keyup', up, true)
        window.removeEventListener('blur', blur)
        if (activeHotkeyCleanup === cleanup) activeHotkeyCleanup = null
        if (typeof window !== 'undefined' && window.__dsh_voice_hotkey_cleanup === cleanup) {
          window.__dsh_voice_hotkey_cleanup = null
        }
      }
      activeHotkeyCleanup = cleanup
      if (typeof window !== 'undefined') {
        window.__dsh_voice_hotkey_cleanup = cleanup
      }
      return cleanup
    }
