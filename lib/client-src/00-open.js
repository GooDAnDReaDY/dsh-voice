
window.__ModuleLoader__.load({
  id: '@goodandready/dsh-voice',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    let React = require('react')
    const h = React.createElement

    let ChevronIcon = null
    try {
      const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
      ChevronIcon = primitives && (primitives.IconChevronDownOutline14 || primitives.IconChevronDownOutline)
    } catch {
      ChevronIcon = null
    }

    const NS = 'dsh-voice'
    const PKG = '@goodandready/dsh-voice'
    const ROW_ID = 'dsh-voice'
    const ROW_CONFIG_KEY = PKG + '#' + ROW_ID

