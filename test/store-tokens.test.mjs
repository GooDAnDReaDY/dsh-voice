import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function loadClientHelpers() {
  const tokensSrc = fs.readFileSync(path.join(rootDir, 'lib', 'client-src', '22-design-tokens.js'), 'utf8')
  const primsSrc = fs.readFileSync(path.join(rootDir, 'lib', 'client-src', '29-ui-primitives.js'), 'utf8')
  const storeSrc = fs.readFileSync(path.join(rootDir, 'lib', 'client-src', '70-draft-store.js'), 'utf8')
  const ctx = {
    React: {
      createElement(type, props, ...children) {
        return { type, props: props || {}, children }
      },
    },
    structuredClone,
  }
  vm.createContext(ctx)
  vm.runInContext(`${tokensSrc}
${primsSrc}
${storeSrc}
globalThis.EXPORTS = { DESIGN_TOKENS, UiActionButton, UiStatusBadge, UiSectionCard, UiCheckToggle, createSettingsDraftStore, validateSettingsDraft, isSettingsDraftDirty }`, ctx)
  return ctx.EXPORTS
}

test('Issue #308: SettingsDraftStore tracks savedConfig vs draftConfig, isDirty, isValid, patchDraft, reset, and commit', async () => {
  const { createSettingsDraftStore } = loadClientHelpers()
  const store = createSettingsDraftStore({
    hotkey: 'Alt+V',
    historyLimit: 20,
    noiseGateDb: -45,
    dictation: { vadSilenceMs: 700 },
  })

  assert.equal(store.getState().isDirty, false)
  assert.equal(store.getState().isValid, true)

  store.patchDraft('hotkey', 'Ctrl+Space')
  assert.equal(store.getState().isDirty, true)
  assert.equal(store.getState().draftConfig.hotkey, 'Ctrl+Space')
  assert.equal(store.getState().savedConfig.hotkey, 'Alt+V')

  store.patchNestedDraft('dictation', 'vadSilenceMs', 900)
  assert.equal(store.getState().draftConfig.dictation.vadSilenceMs, 900)

  // Invalid value check
  store.patchDraft('noiseGateDb', 25)
  assert.equal(store.getState().isValid, false)
  assert.ok(store.getState().errors.noiseGateDb)
  await assert.rejects(() => store.commit(async () => {}), /noiseGateDb/)

  // Reset restores canonical savedConfig
  store.reset()
  assert.equal(store.getState().isDirty, false)
  assert.equal(store.getState().isValid, true)
  assert.equal(store.getState().draftConfig.hotkey, 'Alt+V')

  // Commit persists and clears dirty state
  store.patchDraft('hotkey', 'F9')
  assert.equal(store.getState().isDirty, true)
  await store.commit(async (draft) => ({ ...draft, revision: 2 }))
  assert.equal(store.getState().isDirty, false)
  assert.equal(store.getState().savedConfig.hotkey, 'F9')
})

test('Issue #311: DESIGN_TOKENS uses exclusively DSH CSS variables and Ui primitives render cleanly', () => {
  const { DESIGN_TOKENS, UiActionButton, UiStatusBadge, UiSectionCard, UiCheckToggle } = loadClientHelpers()
  assert.equal(DESIGN_TOKENS.surface.cardBg, 'var(--dsw-alias-bg-layer-3)')
  assert.equal(DESIGN_TOKENS.text.primary, 'var(--dsw-alias-label-primary)')

  const btn = UiActionButton({ variant: 'primary', size: 'sm', disabled: false, children: 'Save' })
  assert.equal(btn.type, 'button')
  assert.equal(btn.props.className, 'cb-btn cb-btn-primary')

  const badge = UiStatusBadge({ status: 'ok', children: 'Online' })
  assert.equal(badge.props.className, 'cb-badge cb-badge-ok')

  const card = UiSectionCard({ title: 'Audio', icon: '🎙️', description: 'Desc', children: 'Body' })
  assert.equal(card.props.className, 'cb-section-card')

  const toggle = UiCheckToggle({ checked: true, label: 'Enable' })
  assert.equal(toggle.props.className, 'cb-check-label')
})
