    exports.inject = ['timer', 'slots', 'settingsScope', 'locale']
    exports.apply = function apply(ctx) {
      // English is the source language. Other languages come from the
      // separate translation plugin at runtime. Re-registering the same
      // namespace+language throws, so tolerate a pre-registered dictionary.
      const addLocale = (locale, dictionary) => {
        try {
          return ctx.locale.register(NS, locale, dictionary)
        } catch (alreadyTaken) {
          return () => {}
        }
      }
      ctx.effect(() => {
        const undo = [addLocale('en', en)]
        return () => { for (const off of undo) off() }
      }, 'dsh-voice: locale dictionaries')
      moduleT = ctx.locale.bind(NS)
      registerComposer(ctx)
      registerSettings(ctx)
    }
    return module.exports
  },
})
