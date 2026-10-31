    // Atomic UI primitives built on DESIGN_TOKENS (#311)
    function UiActionButton(props) {
      const variant = props.variant === 'primary' ? 'cb-btn cb-btn-primary' : 'cb-btn'
      const cls = props.className ? (variant + ' ' + props.className) : variant
      const baseStyle = props.size === 'sm'
        ? { fontSize: DESIGN_TOKENS.font.sm, padding: DESIGN_TOKENS.space.xs + ' ' + DESIGN_TOKENS.space.sm }
        : undefined
      return React.createElement(
        'button',
        {
          type: 'button',
          className: cls,
          disabled: !!props.disabled,
          title: props.title,
          style: baseStyle && props.style ? Object.assign({}, baseStyle, props.style) : (props.style || baseStyle),
          onClick: props.onClick,
        },
        props.children,
      )
    }

    function UiStatusBadge(props) {
      const kind = props.status === 'ok'
        ? 'cb-badge cb-badge-ok'
        : (props.status === 'warn' ? 'cb-badge cb-badge-warn' : (props.status === 'err' ? 'cb-badge cb-badge-err' : 'cb-badge'))
      return React.createElement('span', { className: kind, title: props.title }, props.children)
    }

    function UiSectionCard(props) {
      return React.createElement(
        'div',
        { className: 'cb-section-card', style: props.style },
        props.title ? React.createElement(
          'div',
          { className: 'cb-section-title' },
          React.createElement('span', null, (props.icon ? props.icon + ' ' : '') + props.title),
          props.actions || null,
        ) : null,
        props.description ? React.createElement('div', { className: 'cb-section-desc' }, props.description) : null,
        props.children,
      )
    }

    function UiCheckToggle(props) {
      return React.createElement(
        'label',
        { className: 'cb-check-label' },
        React.createElement('input', {
          type: 'checkbox',
          checked: !!props.checked,
          disabled: !!props.disabled,
          onChange: (e) => props.onChange && props.onChange(e.target.checked, e),
        }),
        props.label,
      )
    }
