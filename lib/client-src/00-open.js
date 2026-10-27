// dsh-voice — client half (browser).
//
// Dictation (mic), voice message (wave), dock pill and settings card.

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
    // Plugins page row seat (DSH 0.1.6-alpha.2): key = '<package name>#<row id>'.
    const PKG = '@goodandready/dsh-voice'
    const ROW_ID = 'dsh-voice'
    const ROW_CONFIG_KEY = PKG + '#' + ROW_ID

    // UI strings in locale registry; English is source/default.
