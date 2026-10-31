    // Unidirectional SettingsDraftStore for canonical vs draft state, validation & rollback (#308)
    function cloneSettingsObj(obj) {
      if (!obj || typeof obj !== 'object') return obj
      if (typeof structuredClone === 'function') {
        try { return structuredClone(obj) } catch (_) {}
      }
      try { return JSON.parse(JSON.stringify(obj)) } catch (_) { return Object.assign({}, obj) }
    }

    function validateSettingsDraft(draft) {
      const errors = {}
      if (!draft || typeof draft !== 'object') return { isValid: true, errors }
      if (draft.historyLimit !== undefined && (Number.isNaN(Number(draft.historyLimit)) || Number(draft.historyLimit) < 0)) {
        errors.historyLimit = 'historyLimit must be >= 0'
      }
      if (draft.noiseGateDb !== undefined && (Number.isNaN(Number(draft.noiseGateDb)) || Number(draft.noiseGateDb) > 0 || Number(draft.noiseGateDb) < -100)) {
        errors.noiseGateDb = 'noiseGateDb must be between -100 and 0'
      }
      if (draft.dictation && draft.dictation.vadSilenceMs !== undefined && Number(draft.dictation.vadSilenceMs) < 0) {
        errors['dictation.vadSilenceMs'] = 'vadSilenceMs must be >= 0'
      }
      return { isValid: Object.keys(errors).length === 0, errors }
    }

    function isSettingsDraftDirty(savedConfig, draftConfig) {
      if (!savedConfig || !draftConfig) return false
      try {
        return JSON.stringify(savedConfig) !== JSON.stringify(draftConfig)
      } catch (_) {
        return true
      }
    }

    function createSettingsDraftStore(initialSaved = null) {
      let savedConfig = initialSaved ? cloneSettingsObj(initialSaved) : null
      let draftConfig = initialSaved ? cloneSettingsObj(initialSaved) : null
      const listeners = new Set()
      const notify = () => { for (const fn of listeners) { try { fn() } catch (_) {} } }

      return {
        getState() {
          const { isValid, errors } = validateSettingsDraft(draftConfig)
          return {
            savedConfig,
            draftConfig,
            isDirty: isSettingsDraftDirty(savedConfig, draftConfig),
            isValid,
            errors,
          }
        },
        setSavedConfig(cfg) {
          savedConfig = cfg ? cloneSettingsObj(cfg) : null
          if (draftConfig === null && savedConfig !== null) {
            draftConfig = cloneSettingsObj(savedConfig)
          }
          notify()
        },
        patchDraft(key, val) {
          draftConfig = Object.assign({}, draftConfig || {}, { [key]: val })
          notify()
          return draftConfig
        },
        patchNestedDraft(mode, key, val) {
          const next = Object.assign({}, draftConfig || {})
          next[mode] = Object.assign({}, next[mode] || {}, { [key]: val })
          draftConfig = next
          notify()
          return draftConfig
        },
        reset() {
          draftConfig = savedConfig ? cloneSettingsObj(savedConfig) : null
          notify()
          return draftConfig
        },
        async commit(saveFn) {
          const st = this.getState()
          if (!st.isValid) {
            throw new Error(Object.values(st.errors)[0] || 'Invalid settings draft')
          }
          const prevSaved = savedConfig ? cloneSettingsObj(savedConfig) : null
          const nextSaved = await saveFn(cloneSettingsObj(draftConfig))
          savedConfig = cloneSettingsObj(nextSaved || draftConfig)
          draftConfig = cloneSettingsObj(savedConfig)
          notify()
          return { savedConfig, prevSaved }
        },
        subscribe(fn) {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
      }
    }
