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
          (page || open) ? React.createElement('div', { className: 'dvo-pbody' }, React.createElement(VoiceSection, props)) : null,
        ),
      )
    }

    function registerSettings(ctx) {
      // List seat (plugins.item): the seat the Plugins page renders as the plugin's
      // own page with its configuration — the host draws the title, icon and crumb
      // and asks for view 'summary' (the card's one-liner) or view 'page' (the form).
      // The label is a static string on purpose: it is resolved while the page
      // renders, and a locale lookup there would take the whole client batch down.
      ctx.slots.inject('plugins.item', () => ctx.slots.register(
        {
          name: 'plugins.item',
          id: ROW_ID,
          order: 60,
          label: () => 'Voice input',
          locale: NS,
          inject: () => ({ ctx: ctx }),
        },
        PluginCard,
      ))
      // Row seat and the legacy card stay as fallbacks.
      ctx.slots.inject('plugins.row.config', () => ctx.slots.register(
        {
          name: 'plugins.row.config',
          key: ROW_CONFIG_KEY,
          locale: NS,
          inject: () => ({ ctx: ctx }),
        },
        PluginCard,
      ))
      ctx.slots.inject('settings.plugin.item', () => ctx.slots.register(
        {
          name: 'settings.plugin.item',
          key: NS,
          locale: NS,
          inject: () => ({ ctx: ctx }),
        },
        PluginCard,
      ))
    }

