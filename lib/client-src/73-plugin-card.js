    // Card in Settings → Plugins → Plugin settings (#18)
    function PluginCard(props) {
      const page = !!(props && props.view === 'page')
      const [open, setOpen] = React.useState(!!page)
      const tt = (props && props.t) || t
      const title = tt('title')
      // Row seat (plugins.row.config): the host page draws title/icon/crumb and the
      // padding, so the summary is a one-liner and the page drops our card chrome.
      if (props && props.view === 'summary') {
        return React.createElement('span', { className: 'dvo-pdesc' }, tt('cardHint'))
      }
      return React.createElement(ErrorBoundary, null,
        React.createElement(page ? 'div' : 'li',
          { className: page ? 'dvo-ppage' : (open ? 'dvo-pcard dvo-pcardOpen' : 'dvo-pcard') },
          React.createElement('button',
            {
              type: 'button', className: 'dvo-phead',
              style: page ? { display: 'none' } : undefined,
              'aria-expanded': page ? 'true' : (open ? 'true' : 'false'),
              'aria-label': (open ? tt('collapse') : tt('expand')) + ': ' + title,
              onClick: () => setOpen((v) => !v),
            },
            React.createElement('span', { className: 'dvo-pheadtext' },
              React.createElement('span', { className: 'dvo-ptitle' }, title),
              React.createElement('span', { className: 'dvo-pdesc' }, tt('cardHint')),
            ),
            React.createElement('span', { className: 'dvo-pchev' }, chevronIcon()),
          ),
          (page || open) ? React.createElement('div', { className: 'dvo-pbody dvo-settings-root' }, React.createElement(VoiceSection, props)) : null,
        ),
      )
    }

    function registerSettings(ctx) {
      ctx.effect(() => {
        const offCss = installSettingsCss()
        const offItem = ctx.slots.inject('plugins.item', () => ctx.slots.register(
          {
            name: 'plugins.item',
            id: ROW_ID,
            order: 60,
            label: () => t('voiceInput'),
            locale: NS,
            inject: () => ({ ctx: ctx }),
          },
          PluginCard,
        ))
        const offRow = ctx.slots.inject('plugins.row.config', () => ctx.slots.register(
          {
            name: 'plugins.row.config',
            key: ROW_CONFIG_KEY,
            locale: NS,
            inject: () => ({ ctx: ctx }),
          },
          PluginCard,
        ))
        const offLegacy = ctx.slots.inject('settings.plugin.item', () => ctx.slots.register(
          {
            name: 'settings.plugin.item',
            key: NS,
            locale: NS,
            inject: () => ({ ctx: ctx }),
          },
          PluginCard,
        ))
        return () => {
          if (typeof offCss === 'function') offCss()
          if (typeof offItem === 'function') offItem()
          if (typeof offRow === 'function') offRow()
          if (typeof offLegacy === 'function') offLegacy()
        }
      }, 'dsh-voice: settings card slots')
    }

