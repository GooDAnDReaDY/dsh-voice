    // ------------------------------------------------------- settings page
    const BUILTIN = [
      'browser', 'deepgram', 'groq', 'hf', 'local-whisper', 'sensevoice',
      // Presets: address and model are filled on the host; only a key is needed.
      'openai', 'siliconflow', 'deepinfra', 'fireworks', 'mistral', 'openrouter',
    ]
    const TEMPLATES = ['openai-transcriptions', 'openai-chat-audio']
    // Resolve at render time: t() must not be captured before locale bind.
    const MODEL_HINT_KEYS = {
      browser: 'browserHint',
      openai: 'openaiHint',
      siliconflow: 'siliconflowHint',
      deepinfra: 'deepinfraHint',
      fireworks: 'fireworksHint',
      mistral: 'mistralHint',
      openrouter: 'openrouterHint',
      'local-whisper': 'localHint',
      sensevoice: 'sensevoiceHint',
    }
    const MODEL_HINT_STATIC = {
      deepgram: 'nova-2',
      groq: 'whisper-large-v3-turbo',
      hf: 'openai/whisper-large-v3',
    }
    function modelHint(provider) {
      const key = MODEL_HINT_KEYS[provider]
      if (key) return t(key)
      return MODEL_HINT_STATIC[provider] || ''
    }
    const LANGS = ['auto', 'ru', 'en', 'uk', 'de']

    const SET_CSS =
      '.dvs-wrap{display:flex;flex-direction:column;gap:22px;padding:4px 0;max-width:720px}' +
      '.dvs-block{display:flex;flex-direction:column;gap:10px}' +
      '.dvs-h{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}' +
      '.dvs-sub{font-size:12px;color:var(--dsw-alias-label-secondary)}' +
      '.dvs-row{display:flex;gap:8px;align-items:center}' +
      '.dvs-row select,.dvs-row input{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:6px 8px;font-size:13px}' +
      '.dvs-row .dvs-model{flex:1}' +
      '.dvs-field{display:flex;flex-direction:column;gap:6px;padding:12px 0;font-size:12px;color:var(--dsw-alias-label-secondary)}' +
      '.dvs-field input,.dvs-field select{height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px}' +
      '.dvs-mini{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:6px;width:28px;height:28px;cursor:pointer;flex:none}' +
      '.dvs-save{appearance:none;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font-size:13px;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}' +
      '.dvs-card{display:flex;flex-direction:column;gap:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:10px}' +
      '.dvs-card input,.dvs-card select{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:6px 8px;font-size:13px}' +
      '.dvs-wait{font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.5;max-width:520px}' +
      '.dvs-ok{font-size:12px;color:var(--dsw-alias-state-success-primary)}' +
      '.dvs-bad{font-size:12px;color:var(--dsw-alias-state-error-primary)}' +
      '.dvo-pcard{list-style:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px}' +
      '.dvo-phead{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;display:flex;align-items:center;gap:12px;padding:14px 16px}' +
      '.dvo-pheadtext{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}' +
      '.dvo-ptitle{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}' +
      '.dvo-pdesc{color:var(--dsw-alias-label-secondary);font-size:13px}' +
      '.dvo-pchev{flex:none;display:flex;color:var(--dsw-alias-label-secondary);transition:transform .15s ease}' +
      '.dvo-pcardOpen .dvo-pchev{transform:rotate(180deg)}' +
      '.dvo-pbody{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}'
    const setCssId = 'dsh-voice/settings.module.css'
    if (typeof document !== 'undefined' && !document.querySelector('style[data-dsh-plugin="dsh-voice"][data-plugin-css="' + setCssId + '"]')) {
      const tag = document.createElement('style')
      tag.textContent = SET_CSS
      tag.setAttribute('data-dsh-plugin', 'dsh-voice')
      tag.dataset.pluginCss = setCssId
      document.head.appendChild(tag)
    }

    // One chain editor: provider+model rows with reordering.
    function ChainEditor(props) {
      const rows = Array.isArray(props.value) ? props.value : []
      const change = (i, patch) => {
        const next = rows.map((r, k) => (k === i ? Object.assign({}, r, patch) : r))
        props.onChange(next)
      }
      const move = (i, delta) => {
        const j = i + delta
        if (j < 0 || j >= rows.length) return
        const next = rows.slice()
        const tmp = next[i]; next[i] = next[j]; next[j] = tmp
        props.onChange(next)
      }
      const remove = (i) => props.onChange(rows.filter((_, k) => k !== i))
      const add = () => props.onChange(rows.concat([{ provider: 'local-whisper', model: '' }]))
      const options = Array.isArray(props.options) && props.options.length ? props.options : BUILTIN

      return React.createElement('div', { className: 'dvs-block' },
        rows.map((row, i) => React.createElement('div', { className: 'dvs-row', key: i },
          React.createElement('select', {
            value: row.provider, disabled: !props.writable,
            onChange: (e) => change(i, { provider: e.target.value }),
          }, (options.indexOf(row.provider) < 0 ? options.concat([row.provider]) : options)
            .map((p) => React.createElement('option', { key: p, value: p }, p))),
          React.createElement('input', {
            className: 'dvs-model', value: row.model || '', disabled: !props.writable,
            placeholder: modelHint(row.provider), onChange: (e) => change(i, { model: e.target.value }),
          }),
          React.createElement('button', { type: 'button', className: 'dvs-mini', title: t('up'), disabled: !props.writable, onClick: () => move(i, -1) }, '↑'),
          React.createElement('button', { type: 'button', className: 'dvs-mini', title: t('down'), disabled: !props.writable, onClick: () => move(i, 1) }, '↓'),
          React.createElement('button', { type: 'button', className: 'dvs-mini', title: t('remove'), disabled: !props.writable, onClick: () => remove(i) }, '×'),
        )),
        React.createElement('div', { className: 'dvs-row' },
          React.createElement('button', { type: 'button', className: 'dvs-mini', title: t('addProvider'), disabled: !props.writable, onClick: add }, '+'),
          React.createElement('span', { className: 'dvs-sub' }, t('chainHint')),
        ),
      )
    }

    // Custom providers: name, API template, where to call, how to authorize.
    function CustomEditor(props) {
      const rows = Array.isArray(props.value) ? props.value : []
      const change = (i, patch) => props.onChange(rows.map((r, k) => (k === i ? Object.assign({}, r, patch) : r)))
      const remove = (i) => props.onChange(rows.filter((_, k) => k !== i))
      const add = () => props.onChange(rows.concat([
        { key: '', template: 'openai-transcriptions', baseURL: '', model: '', keyEnv: '', prompt: '' },
      ]))
      const field = (i, row, name, placeholder, wide) => React.createElement('input', {
        className: wide ? 'dvs-model' : '', value: row[name] || '', placeholder: placeholder,
        disabled: !props.writable, onChange: (e) => change(i, { [name]: e.target.value }),
      })

      return React.createElement('div', { className: 'dvs-block' },
        rows.map((row, i) => React.createElement('div', { className: 'dvs-card', key: i },
          React.createElement('div', { className: 'dvs-row' },
            field(i, row, 'key', t('customName')),
            React.createElement('select', {
              value: row.template || 'openai-transcriptions', disabled: !props.writable,
              onChange: (e) => change(i, { template: e.target.value }),
            }, TEMPLATES.map((t) => React.createElement('option', { key: t, value: t }, t))),
            React.createElement('button', {
              type: 'button', className: 'dvs-mini', title: t('remove'),
              disabled: !props.writable, onClick: () => remove(i),
            }, '\u00d7'),
          ),
          React.createElement('div', { className: 'dvs-row' },
            field(i, row, 'baseURL', 'https://openrouter.ai/api/v1', true),
          ),
          React.createElement('div', { className: 'dvs-row' },
            field(i, row, 'model', t('customModel'), true),
            field(i, row, 'keyEnv', t('customKeyName')),
          ),
          row.template === 'openai-chat-audio'
            ? React.createElement('div', { className: 'dvs-row' },
              field(i, row, 'prompt', t('customModelHint'), true))
            : null,
        )),
        React.createElement('div', { className: 'dvs-row' },
          React.createElement('button', {
            type: 'button', className: 'dvs-mini', title: t('addCustom'),
            disabled: !props.writable, onClick: add,
          }, '+'),
          React.createElement('span', { className: 'dvs-sub' },
            t('openrouterWarning')),
        ),
      )
    }

    function VoiceSection(props) {
      const t = (props && props.t) || moduleT
      const ctx = props.ctx
      // On a non-localhost page the kernel disables settings entirely: the
      // shared document is not readable, every section gets "unavailable" and
      // writes are dropped. The server does not share that restriction, and
      // dsh-lanmode rebuilds the same mechanics on the same calls. Prefer its
      // service when installed, otherwise the kernel one (fine on loopback).
      const scope = ((ctx.get && ctx.get('lanSettings')) || ctx.settingsScope).bind({ namespace: NS })
      const [snap, setSnap] = React.useState(null)
      const [draft, setDraft] = React.useState(null)
      const [saved, setSaved] = React.useState(false)
      const [err, setErr] = React.useState('')

      // Hotkey picker: not a name field — press the key you want. Users should
      // not need to know codes like KeyR.
      //
      // Hooks are declared here, above every return: declaring them later
      // would leave fewer hooks on the not-ready branch and React would
      // unmount the section with an error.
      const [catching, setCatching] = React.useState(false)
      React.useEffect(() => {
        if (!catching) return undefined
        const onKey = (event) => {
          event.preventDefault()
          event.stopPropagation()
          if (event.key === 'Escape') { setCatching(false); return }
          const chosen = keyFromEvent(event)
          setDraft((d) => Object.assign({}, d || {}, { hotkey: chosen }))
          setCatching(false)
        }
        document.addEventListener('keydown', onKey, true)
        return () => document.removeEventListener('keydown', onKey, true)
      }, [catching])

      React.useEffect(() => {
        let alive = true
        const render = () => { if (alive) setSnap(scope.getSnapshot()) }
        render()
        const off = scope.subscribe(render)
        return () => { alive = false; off() }
      }, [])

      const [devices, setDevices] = React.useState([])
      React.useEffect(() => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return
        navigator.mediaDevices.enumerateDevices()
          .then((list) => setDevices(list.filter((d) => d.kind === 'audioinput')))
          .catch(() => {})
      }, [])

      // The snapshot carries a status, and status matters more than value.
      //   loading      — no host answer yet;
      //   unavailable  — host answered but does not know this namespace yet
      //                  (page opened in the first seconds while plugins register);
      //   ready        — values are present.
      // At unavailable, writable comes from the document and stays true, so
      // without a status check the card draws an empty but seemingly working
      // form — that is exactly how this bug looked.
      const ready = !!snap && snap.status === 'ready'
      const value = ready && snap.value ? snap.value : {}
      const writable = ready && snap.writable !== false

      // The browser settings mirror reloads only on value writes and
      // reconnect; a new namespace is not such a signal. It will not fix
      // itself — ask it to reload until ready. The mirror is shared, so this
      // also repairs other settings sections.
      React.useEffect(() => {
        if (ready) return undefined
        let tries = 0
        const timer = setInterval(() => {
          if (tries >= 15) { clearInterval(timer); return }
          tries += 1
          try { ((ctx.get && ctx.get('lanSettings')) || ctx.settingsScope).describe().load() } catch (e) { /* service not up yet */ }
        }, 1000)
        return () => clearInterval(timer)
      }, [ready])

      // Seed the draft only from a ready snapshot. Previously it was filled
      // from the first snapshot and an empty draft froze forever: later
      // snapshots did not reseed it and the card stayed empty until reload.
      React.useEffect(() => { if (ready && draft === null) setDraft(JSON.parse(JSON.stringify(value))) }, [ready, draft, value])
      // The client needs the VAD threshold and cancel window from the same settings.
      React.useEffect(() => {
        if (!ready) return
        voice.settings = Object.assign({}, voice.settings, {
          vadSilenceMs: Number(value && value.dictation && value.dictation.vadSilenceMs) || 700,
          autoSendMs: Number(value && value.message && value.message.autoSendMs) || 4000,
          beep: !!(snap && snap.beep),
          micDeviceId: String((snap && snap.micDeviceId) || ''),
          historyLimit: Number(snap && snap.historyLimit),
          voiceCommands: !!(snap && snap.voiceCommands),
          sendDelayMs: Number(value && value.dictation && value.dictation.sendDelayMs) || 0,
          stream: !!(value && value.dictation && value.dictation.stream),
          streamChunkMs: Number(value && value.dictation && value.dictation.streamChunkMs) || 1200,
          vadAdapt: Number(value && value.dictation && value.dictation.vadAdapt) || 0,
          wakeWord: String((snap && snap.wakeWord) || ''),
          bargeIn: !!(snap && snap.bargeIn),
          polishSend: !!(value && value.message && value.message.polishSend),
          sessionCommands: !!(value && value.message && value.message.sessionCommands),
          polishBaseUrl: String((snap && snap.polishBaseUrl) || ''),
          noiseSuppression: value.noiseSuppression !== false,
          contextGlossary: value.contextGlossary !== false,
        })
      }, [ready, value, snap])

      const [statsData, setStatsData] = React.useState({})
      React.useEffect(() => {
        let alive = true
        fetch('/dsh-voice/status', { cache: 'no-store' })
          .then((r) => r.json())
          .then((data) => {
            if (alive && data && data.providerStats) {
              setStatsData(data.providerStats)
            }
          })
          .catch(() => {})
        return () => { alive = false }
      }, [])

      if (!ready) {
        const waiting = !snap || snap.status === 'loading'
        return React.createElement('div', { className: 'dvs-wrap' },
          React.createElement('div', { className: 'dvs-wait' }, waiting
            ? t('loadingSettings')
            : t('notReady1')
              + t('notReady2')),
        )
      }

      const setIn = (mode, key, v) => setDraft((d) => {
        const next = JSON.parse(JSON.stringify(d || {}))
        next[mode] = next[mode] || {}
        next[mode][key] = v
        return next
      })
      const setTop = (key, v) => setDraft((d) => Object.assign({}, d || {}, { [key]: v }))

      const save = async () => {
        setErr(''); setSaved(false)
        if (!draft) return

        // Fields are written one by one. Previously the first failure broke
        // the loop: later fields were never saved, the composer never got the
        // hotkey reload signal, and the button looked like "nothing happens".
        // Now every field is attempted and failures are collected by name.
        const failed = []
        for (const k of Object.keys(draft)) {
          try {
            await scope.set(k, draft[k])
          } catch (e) {
            failed.push(k + ': ' + String(e && e.message ? e.message : e))
          }
        }

        Object.assign(voice.settings, {
          vadSilenceMs: Number(draft.dictation && draft.dictation.vadSilenceMs) || 700,
          autoSendMs: Number(draft.message && draft.message.autoSendMs) || 4000,
          beep: !!draft.beep,
          micDeviceId: String(draft.micDeviceId || ''),
          historyLimit: Number(draft.historyLimit),
          voiceCommands: !!draft.voiceCommands,
          sendDelayMs: Number(draft.dictation && draft.dictation.sendDelayMs) || 0,
          stream: !!(draft.dictation && draft.dictation.stream),
          streamChunkMs: Number(draft.dictation && draft.dictation.streamChunkMs) || 1200,
          vadAdapt: Number(draft.dictation && draft.dictation.vadAdapt) || 0,
          noiseSuppression: draft.noiseSuppression !== false,
          contextGlossary: draft.contextGlossary !== false,
          visualizerStyle: draft.visualizerStyle || 'liquid-wave',
        })
        // The composer owns the hotkey handler — tell it to reload, otherwise
        // a new key only works after a full page reload.
        try { window.dispatchEvent(new CustomEvent('dsh-voice:settings-saved')) } catch (noEvents) { /* nobody */ }

        if (failed.length) { setErr(t('saveFailed') + ' ' + failed.join('; ')); return }
        setSaved(true); setTimeout(() => setSaved(false), 2000)
      }

      const modeVal = (mode, key, fallback) => {
        const m = draft && draft[mode]
        return m && m[key] !== undefined ? m[key] : fallback
      }

      // Custom provider names come from the draft so a just-added entry
      // appears in chain selects immediately.
      const chainOptions = BUILTIN.concat(
        (draft && Array.isArray(draft.customProviders) ? draft.customProviders : [])
          .map((c) => String(c && c.key || '').trim())
          .filter((k) => k && BUILTIN.indexOf(k) < 0),
      )

      const hotkeyField = () => React.createElement('label', { className: 'dvs-field' },
        t('hotkey'),
        React.createElement('div', { className: 'dvs-row' },
          React.createElement('button', {
            type: 'button', className: 'dvs-save', disabled: !writable,
            onClick: () => setCatching(true),
          }, catching ? t('pressKey') : keyLabel(draft && draft.hotkey)),
          React.createElement('button', {
            type: 'button', className: 'dvs-mini', title: t('clearKey'),
            disabled: !writable, onClick: () => setDraft((d) => Object.assign({}, d || {}, { hotkey: '' })),
          }, '×'),
        ),
        React.createElement('span', { className: 'dvs-sub' },
          t('hotkeyHint1')
          + t('hotkeyHint2')))

      const micField = () => React.createElement('label', { className: 'dvs-field' }, t('mic'),
          React.createElement('select', {
            value: String((snap && snap.micDeviceId) || ''), disabled: !writable,
            onChange: (e) => setTop('micDeviceId', e.target.value),
          },
            React.createElement('option', { value: '' }, t('micDefault')),
            devices.map((d) => React.createElement('option', { key: d.deviceId, value: d.deviceId },
              d.label || d.deviceId.slice(0, 12)))))
      const langField = (mode) => React.createElement('label', { className: 'dvs-field' }, t('language'),
        React.createElement('select', {
          value: modeVal(mode, 'language', 'ru'), disabled: !writable,
          onChange: (e) => setIn(mode, 'language', e.target.value),
        }, LANGS.map((o) => React.createElement('option', { key: o, value: o }, o))))

      const numField = (mode, key, label, hint) => React.createElement('label', { className: 'dvs-field' }, label,
        React.createElement('input', {
          type: 'number', value: modeVal(mode, key, ''), disabled: !writable,
          onChange: (e) => setIn(mode, key, Number(e.target.value)),
        }),
        React.createElement('span', { className: 'dvs-sub' }, hint))

      const textField = (key, label, hint) => React.createElement('label', { className: 'dvs-field' }, label,
        React.createElement('input', {
          value: draft && draft[key] !== undefined ? draft[key] : '', disabled: !writable,
          onChange: (e) => setTop(key, e.target.value),
        }),
        React.createElement('span', { className: 'dvs-sub' }, hint))

      return React.createElement('div', { className: 'dvs-wrap' },
        React.createElement('div', { className: 'dvs-block' },
          React.createElement('div', { className: 'dvs-h' }, t('dictationBtn')),
          React.createElement('div', { className: 'dvs-sub' }, t('dictationHint')),
          React.createElement(ChainEditor, {
            value: draft && draft.dictation ? draft.dictation.chain : [], writable: writable,
            options: chainOptions,
            onChange: (v) => setIn('dictation', 'chain', v),
          }),
          langField('dictation'),
          numField('dictation', 'vadSilenceMs', t('pauseMs'), t('pauseHint')),
          numField('dictation', 'sendDelayMs', t('sendDelay'), t('sendDelayHint')),
          React.createElement('label', { className: 'dvs-field' }, t('polish'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.dictation && draft.dictation.polish), disabled: !writable,
              onChange: (e) => setIn('dictation', 'polish', e.target.checked),
            })),
          React.createElement('div', { className: 'dvs-sub' }, t('polishHint')),
          React.createElement('label', { className: 'dvs-field', title: t('wakeWordHint') }, t('wakeWord'),
            React.createElement('input', {
              type: 'text', value: String((snap && snap.wakeWord) || ''), disabled: !writable,
              onChange: (e) => setTop('wakeWord', e.target.value),
            })),
          React.createElement('label', { className: 'dvs-field', title: t('streamHint') }, t('stream'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.dictation && draft.dictation.stream), disabled: !writable,
              onChange: (e) => setIn('dictation', 'stream', e.target.checked),
            })),
          numField('dictation', 'streamChunkMs', t('streamChunkMs'), t('streamHint')),
          React.createElement('label', { className: 'dvs-field', title: t('vadAdaptHint') }, t('vadAdapt'),
            React.createElement('input', {
              type: 'range', min: 0, max: 1, step: 0.1,
              value: Number(draft && draft.dictation && draft.dictation.vadAdapt) || 0, disabled: !writable,
              onChange: (e) => setIn('dictation', 'vadAdapt', Number(e.target.value)),
            })),
        ),
        React.createElement('div', { className: 'dvs-block' },
          React.createElement('div', { className: 'dvs-h' }, t('messageTitle')),
          React.createElement('div', { className: 'dvs-sub' }, t('messageHint')),
          React.createElement(ChainEditor, {
            value: draft && draft.message ? draft.message.chain : [], writable: writable,
            options: chainOptions,
            onChange: (v) => setIn('message', 'chain', v),
          }),
          langField('message'),
          numField('message', 'autoSendMs', t('undoMs'), t('undoHint')),
          React.createElement('label', { className: 'dvs-field' }, t('polish'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.message && draft.message.polish), disabled: !writable,
              onChange: (e) => setIn('message', 'polish', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field', title: t('polishSendHint') }, t('polishSend'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.message && draft.message.polishSend), disabled: !writable,
              onChange: (e) => setIn('message', 'polishSend', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field', title: t('sessionCommandsHint') }, t('sessionCommands'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.message && draft.message.sessionCommands), disabled: !writable,
              onChange: (e) => setIn('message', 'sessionCommands', e.target.checked),
            })),
        ),
        React.createElement('div', { className: 'dvs-block' },
          React.createElement('div', { className: 'dvs-h' }, t('customTitle')),
          React.createElement('div', { className: 'dvs-sub' },
            t('customHint')),
          React.createElement(CustomEditor, {
            value: draft && draft.customProviders ? draft.customProviders : [], writable: writable,
            onChange: (v) => setTop('customProviders', v),
          }),
        ),
        React.createElement('div', { className: 'dvs-block' },
          React.createElement('div', { className: 'dvs-h' }, t('general')),
          hotkeyField(),
          textField('whisperUrl', t('whisperEndpoint'), t('whisperEndpointHint')),
          textField('whisperBin', t('whisperBin'), t('whisperBinHint')),
          textField('whisperModel', t('whisperModel'), t('whisperModelHint')),
          textField('deepgramBaseUrl', t('deepgramEndpoint'), t('deepgramEndpointHint')),
          React.createElement('label', { className: 'dvs-field' }, t('whisperAutostart'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.autoStart), disabled: !writable,
              onChange: (e) => setTop('autoStart', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field', title: t('normalizeTranscriptHint') },
            t('normalizeTranscript'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.normalizeTranscript), disabled: !writable,
              onChange: (e) => setTop('normalizeTranscript', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field' }, t('beep'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.beep), disabled: !writable,
              onChange: (e) => setTop('beep', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field', title: t('localOnlyHint') }, t('localOnly'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.localOnly), disabled: !writable,
              onChange: (e) => setTop('localOnly', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field' }, t('voiceCommandsLabel'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.voiceCommands), disabled: !writable,
              onChange: (e) => setTop('voiceCommands', e.target.checked),
            })),
          micField(),
          React.createElement('label', { className: 'dvs-field', title: t('noiseSuppressionHint') }, t('noiseSuppression'),
            React.createElement('input', {
              type: 'checkbox', checked: draft ? draft.noiseSuppression !== false : true, disabled: !writable,
              onChange: (e) => setTop('noiseSuppression', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field', title: t('contextGlossaryHint') }, t('contextGlossary'),
            React.createElement('input', {
              type: 'checkbox', checked: draft ? draft.contextGlossary !== false : true, disabled: !writable,
              onChange: (e) => setTop('contextGlossary', e.target.checked),
            })),
          React.createElement('label', { className: 'dvs-field', title: t('visualizerStyleHint') }, t('visualizerStyle'),
            React.createElement('select', {
              value: String((draft && draft.visualizerStyle) || 'liquid-wave'), disabled: !writable,
              onChange: (e) => setTop('visualizerStyle', e.target.value),
            },
              React.createElement('option', { value: 'liquid-wave' }, t('visLiquidWave')),
              React.createElement('option', { value: 'dynamic-orb' }, t('visDynamicOrb')),
              React.createElement('option', { value: 'bars' }, t('visBars')),
              React.createElement('option', { value: 'off' }, t('visOff')),
            )),
          React.createElement('label', { className: 'dvs-field' }, t('vocabulary'),
            React.createElement('textarea', {
              rows: 3, disabled: !writable,
              value: Array.isArray(draft && draft.vocabulary) ? draft.vocabulary.join('\n') : '',
              onChange: (e) => setTop('vocabulary', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean)),
            })),
          React.createElement('label', { className: 'dvs-field', title: t('polishBaseUrlHint') }, t('polishBaseUrl'),
            React.createElement('input', {
              type: 'text', value: String((snap && snap.polishBaseUrl) || ''), disabled: !writable,
              onChange: (e) => setTop('polishBaseUrl', e.target.value),
            })),
          React.createElement('label', { className: 'dvs-field' }, t('polishModel'),
            React.createElement('input', {
              type: 'text', value: String((draft && draft.polishModel) || ''), disabled: !writable,
              onChange: (e) => setTop('polishModel', e.target.value),
            })),
          React.createElement('label', { className: 'dvs-field' }, t('polishKeyEnv'),
            React.createElement('input', {
              type: 'text', value: String((draft && draft.polishKeyEnv) || ''), disabled: !writable,
              onChange: (e) => setTop('polishKeyEnv', e.target.value),
            })),
        ),
        React.createElement('div', { className: 'dvs-block' },
          React.createElement('div', { className: 'dvs-h' }, 'SenseVoice-ONNX / Sherpa-ONNX'),
          React.createElement('div', { className: 'dvs-sub' }, t('sensevoiceHint')),
          textField('sensevoiceUrl', t('sensevoiceEndpoint'), t('sensevoiceEndpointHint')),
          textField('sensevoiceBin', t('sensevoiceBin'), t('sensevoiceBinHint')),
          textField('sensevoiceModel', t('sensevoiceModel'), t('sensevoiceModelHint')),
          React.createElement('label', { className: 'dvs-field' }, t('sensevoiceAutostart'),
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.sensevoiceAutostart), disabled: !writable,
              onChange: (e) => setTop('sensevoiceAutostart', e.target.checked),
            })),
        ),
        React.createElement('div', { className: 'dvs-block' },
          React.createElement('div', { className: 'dvs-h' }, t('providerDashboard')),
          React.createElement('div', { className: 'dvo-dash' },
            React.createElement('div', { className: 'dvo-dash-grid' },
              Object.keys(statsData).length === 0
                ? React.createElement('div', { className: 'dvs-sub' }, t('idle'))
                : Object.entries(statsData).map(([key, item]) => {
                    const avg = item.avgTookMs || 0
                    const hasErrors = item.failures > 0
                    let badgeClass = 'dvo-badge-idle'
                    let badgeText = t('idle')
                    if (item.attempts > 0) {
                      if (hasErrors && item.successes === 0) {
                        badgeClass = 'dvo-badge-err'
                        badgeText = t('error')
                      } else if (avg > 0 && avg < 400) {
                        badgeClass = 'dvo-badge-fast'
                        badgeText = avg + 'ms · ' + t('fast')
                      } else if (avg >= 400 && avg <= 1500) {
                        badgeClass = 'dvo-badge-norm'
                        badgeText = avg + 'ms · ' + t('normal')
                      } else {
                        badgeClass = 'dvo-badge-slow'
                        badgeText = avg + 'ms · ' + t('slow')
                      }
                    }
                    const rate = item.attempts > 0 ? Math.round((item.successes / item.attempts) * 100) : 100
                    return React.createElement('div', { key, className: 'dvo-dash-item', title: item.lastError ? `Error: ${item.lastError}` : '' },
                      React.createElement('div', { className: 'dvo-dash-name' }, key),
                      React.createElement('div', { className: 'dvo-dash-row' },
                        React.createElement('span', { className: 'dvo-badge ' + badgeClass }, badgeText),
                        React.createElement('span', null, rate + '%'),
                      ),
                      React.createElement('div', { className: 'dvo-dash-row' },
                        React.createElement('span', null, `${item.successes}/${item.attempts}`),
                        React.createElement('span', null, t('successRate')),
                      ),
                    )
                  })
            )
          )
        ),
        React.createElement('div', { className: 'dvs-row' },
          React.createElement('button', { type: 'button', className: 'dvs-save', disabled: !writable, onClick: save }, t('save')),
          saved ? React.createElement('span', { className: 'dvs-ok' }, t('saved')) : null,
          err ? React.createElement('span', { className: 'dvs-bad' }, err) : null,
        ),
      )
    }

    // Card in Settings → Plugins → Plugin settings (#18): the kernel only
    // draws the list shell, so title, hint and collapse are ours.
    // Body mounts on first expand; the settings snapshot arrives then.
    function PluginCard(props) {
      const [open, setOpen] = React.useState(false)
      const tt = (props && props.t) || t
      const title = tt('title')
      return React.createElement('li',
        { className: open ? 'dvo-pcard dvo-pcardOpen' : 'dvo-pcard' },
        React.createElement('button',
          {
            type: 'button', className: 'dvo-phead',
            'aria-expanded': open ? 'true' : 'false',
            'aria-label': (open ? tt('collapse') : tt('expand')) + ': ' + title,
            onClick: () => setOpen((v) => !v),
          },
          React.createElement('span', { className: 'dvo-pheadtext' },
            React.createElement('span', { className: 'dvo-ptitle' }, title),
            React.createElement('span', { className: 'dvo-pdesc' }, tt('cardHint')),
          ),
          React.createElement('span', { className: 'dvo-pchev' }, chevronIcon()),
        ),
        open ? React.createElement('div', { className: 'dvo-pbody' }, React.createElement(VoiceSection, props)) : null,
      )
    }

    function registerSettings(ctx) {
      // Settings card under Settings → Plugins → Plugin settings (#18).
      // The registration key must equal NS (the settings namespace), otherwise
      // the tab silently skips the slot.
      ctx.slots.inject('settings.plugin.item', () => ctx.slots.register(
        {
          name: 'settings.plugin.item',
          key: NS,
          // locale on the slot record is what makes the component receive props.t.
          locale: NS,
          inject: () => ({ ctx: ctx }),
        },
        PluginCard,
      ))
    }

