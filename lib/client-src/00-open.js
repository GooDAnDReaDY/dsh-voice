// dsh-voice — client half (browser).
//
// Two buttons in conversation.input.right:
//   mic  — dictation: speech is cut on pauses, each chunk is recognized and
//          appended to the composer; send stays with the user;
//   wave — voice message: one whole recording; after recognition the text is
//          sent to the agent when the cancel window expires.
//
// The recording pill lives in conversation.input.dock; settings are a card
// in settings.plugin.item.

window.__ModuleLoader__.load({
  id: '@goodandready/dsh-voice',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    let React = require('react')

    const NS = 'dsh-voice'

    // UI strings live in the locale registry so a separate package can
    // translate them without touching this plugin. English is the source
    // language, the default, and the fallback.
