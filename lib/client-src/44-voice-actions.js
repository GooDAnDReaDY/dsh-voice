function clearDraft(target) {
  const actions = (target || voice._activeTarget)?.actions || voice.inputActions
  if (typeof actions?.setDraft === 'function') actions.setDraft('')
}

function executeVoiceAction(action, rawText, target) {
  const activeTarget = target || voice._activeTarget
  const acts = (activeTarget && activeTarget.actions) || voice.inputActions
  if (action === 'send') {
    const text = rawText.replace(/(^|[\s,.!?])(отправь|пошли|send)([\s,.!?]|$)/gi, '').trim()
    if (text) appendDraft(text, activeTarget)
    if (typeof acts?.submit === 'function') acts.submit()
    voice.set({ phase: 'idle' })
  } else if (action === 'clear') {
    clearDraft(activeTarget)
    voice.set({ phase: 'idle' })
  } else if (action === 'stop_generation') {
    if (acts?.stop) acts.stop()
    else {
      const btn = typeof document !== 'undefined' && document.querySelector('[data-action="stop"], [aria-label*="Stop"], button.dsw-stop-btn, .chat-stop-btn')
      if (btn) btn.click()
    }
    voice.set({ phase: 'idle' })
  } else if (action === 'switch_dictation') {
    voice.activeMode = 'dictation'; voice.notify()
  } else if (action === 'switch_voice_note') {
    voice.activeMode = 'note'; voice.notify()
  } else if (action === 'new_chat') {
    const newBtn = typeof document !== 'undefined' && document.querySelector('[data-action="new-chat"], button.new-chat-btn, [aria-label*="New topic"], [aria-label*="Новый диалог"]')
    if (newBtn) newBtn.click()
    voice.set({ phase: 'idle' })
  } else if (action === 'newline') {
    const payload = rawText.replace(/(^|[\s,.!?])(с новой строки|новая строка|абзац|new line|paragraph)([\s,.!?]|$)/gi, '').trim()
    appendDraft(payload, activeTarget)
    voice.set({ phase: 'idle' })
  } else if (action === 'undo_chunk') {
    undoLastInsert().then((msg) => {
      voice.lastUndoNotice = msg; voice.notify()
      setTimeout(() => { if (voice.lastUndoNotice === msg) { voice.lastUndoNotice = ''; voice.notify() } }, 3500)
    })
  }
}
