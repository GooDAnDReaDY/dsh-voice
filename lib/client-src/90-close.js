    exports.inject = ['timer', 'slots', 'configForms', 'locale']
    exports.apply = function apply(ctx) {
      // English source/fallback, Chinese built-in dictionary.
      const addLocale = (locale, dictionary) => {
        try {
          return ctx.locale.register(NS, locale, dictionary)
        } catch (alreadyTaken) {
          return () => {}
        }
      }
      ctx.effect(() => {
        const undo = [addLocale('en', en), addLocale('zh', zh)]
        return () => { for (const off of undo) off() }
      }, 'dsh-voice: locale dictionaries')
      ctx.effect(() => {
        return registerGlobalLifecycle()
      }, 'dsh-voice: global lifecycle')
      moduleT = ctx.locale.bind(NS)
      registerComposer(ctx)
      registerSettings(ctx)
    }
    exports._test = {
      voice,
      keyLabel,
      keyFromEvent,
      hotkeyMatches,
      isAllowedInEditable,
      isHotkeyRelease,
      extractContextKeywords,
      DICTATION_MODES,
      getDictationModeLabel,
      cycleDictationMode,
      resolveBrowserRecognitionLang,
      VoiceSection,
      FirstRunWizard,
      cutPhrase,
      sendAudio,
      modeChain,
      openMic,
      startRecording,
      cancelCurrent,
      stopCurrent,
      submitPending,
      cancelPending,
      keepPending,
      initPendingPreview,
      cancelPendingPreview,
      keepPendingPreview,
      submitPendingPreview,
      renderEditablePreviewPill,
      editIcon,
      sendIcon,
      loadWebGpuWhisper,
      isWebGpuSupported,
      isWasmSupported,
      isOfflineSupported,
      waitStop,
      currentLevel,
      accentColor,
      softColor,
    }
    return module.exports
  },
})
