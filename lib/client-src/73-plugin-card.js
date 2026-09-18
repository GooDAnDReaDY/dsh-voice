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
      // Row seat first (the seat the current core renders), legacy card after it.
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

