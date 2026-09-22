    exports.inject = ['timer', 'slots', 'configForms', 'locale']
    exports.apply = function apply(ctx) {
      // English is the source and fallback language; Chinese is the built-in
      // localized user dictionary. Other languages (like Russian) come from
      // the separate translation plugin at runtime.
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
      moduleT = ctx.locale.bind(NS)
      registerComposer(ctx)
      registerSettings(ctx)
    }
    return module.exports
  },
})
