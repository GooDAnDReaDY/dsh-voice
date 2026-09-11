    // Card in Settings → Plugins → Plugin settings (#18)
    function PluginCard(props) {
      const [open, setOpen] = React.useState(false)
      const tt = (props && props.t) || t
      const title = tt('title')
      return React.createElement(ErrorBoundary, null,
        React.createElement('li',
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
        ),
      )
    }

    function registerSettings(ctx) {
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

