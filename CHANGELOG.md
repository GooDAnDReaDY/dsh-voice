# Changelog

Notable changes to `@goodandready/dsh-voice`.

## 0.8.31

### Fixed
- **The plugin no longer breaks the whole client layer**: the two composer
  registrations (`conversation.input.right`, `conversation.input.dock`) declared
  `label` but no `locale`, so the core resolved the label through an empty inject
  face and threw `cannot get property "t" without inject` while building the slot
  snapshot. That exception aborted the client batch, which is why the Settings
  sections and every plugin settings card disappeared. Both entries now declare
  `locale: NS`.
- **Settings reachable again**: the settings card registered into
  `settings.plugin.item`, a slot the current DSH core (0.1.6-alpha.2) no longer
  renders. The surface now registers into the Plugins page row seat
  `plugins.row.config` first, keyed `@goodandready/dsh-voice#dsh-voice`
  (`rowConfigKey(package, rowId)`): the plugin's row gains a configure control whose
  page is the settings form (`view: 'page'`, open and without our card chrome) plus
  a one-line state for `view: 'summary'`. The legacy seat stays as a fallback.

### Added
- This changelog.
