// Cordis plugin entrypoint for @goodandready/dsh-voice (#304) — delegates registerConfigRoutes & name: 'transcribe_audio'
import z from '@deepseek-ai/schemastery'
import { createConfigReader } from './config-compat.js'
import { createStatsTracker } from './stats.js'
import { BaseConfig, makeVolatile as schemaMakeVolatile, resolveConfig } from './schema.js'
import { createServerDaemons } from './server-daemons.js'
import { createServerPipeline, registerServerTools } from './server-tools.js'
import { registerServerRoutes } from './server-routes.js'

export * from './schema.js'
export * from './errors.js'
export const name = '@goodandready/dsh-voice'
export const NS = 'dsh-voice'
export const inject = ['tools', 'credentials', 'webServer', 'shell', 'settings', 'llm']

function makeVolatile(schema) {
  return schemaMakeVolatile(schema)
}

export const Config = typeof z.number().volatile === 'function'
  ? makeVolatile(BaseConfig)
  : BaseConfig

export function apply(ctx, baseConfig) {
  let settingsService = null
  let scope = null
  const readEntryConfig = createConfigReader(baseConfig, ctx)
  let getConfig = readEntryConfig

  const describeRow = () => {
    try { return settingsService?.describe?.()?.find((r) => r && r.ns === NS) || null } catch { return null }
  }
  const live = () => {
    try { return resolveConfig(getConfig() ?? readEntryConfig()) } catch { return resolveConfig(readEntryConfig()) }
  }

  const daemons = createServerDaemons({ live, ctx })
  function triggerAutostart() {
    daemons.triggerAutostart()
  }

  ctx.inject(['settings'], (sctx) => {
    settingsService = sctx.settings
    try {
      if (typeof sctx.settings?.register === 'function') scope = sctx.settings.register(NS, Config, { base: baseConfig })
      getConfig = scope && typeof scope.get === 'function'
        ? () => scope.get() ?? describeRow()?.config ?? readEntryConfig()
        : () => describeRow()?.config ?? readEntryConfig()
      if (scope && typeof scope.watch === 'function') {
        scope.watch(() => {
          triggerAutostart()
        })
      }
    } catch {
      getConfig = () => describeRow()?.config ?? readEntryConfig()
    }
    sctx.effect(() => () => { getConfig = readEntryConfig; scope = null; settingsService = null })
    triggerAutostart()
  })

  if (typeof ctx.effect === 'function' && typeof ctx.on === 'function') {
    ctx.effect(() => ctx.on('loader/volatile-update', () => triggerAutostart()), 'dsh-voice: volatile autostart')
    ctx.effect(() => ctx.on('settings/document-updated', () => triggerAutostart()), 'dsh-voice: settings autostart')
    ctx.effect(() => ctx.on('config', () => triggerAutostart()), 'dsh-voice: config autostart')
  }
  triggerAutostart()

  const statsTracker = createStatsTracker()
  const { transcribe, polishText } = createServerPipeline({ ctx, live, statsTracker })

  registerServerRoutes(ctx, {
    NS,
    live,
    daemons,
    statsTracker,
    transcribe,
    polishText,
    getSettingsService: () => settingsService,
    getScope: () => scope,
    triggerAutostart,
    updateConfig: async (patch) => {
      const merged = { ...live(), ...patch }
      if (settingsService) {
        const rev = describeRow()?.revision
        if (typeof settingsService.replace === 'function') await settingsService.replace(NS, merged, rev)
        else if (typeof settingsService.update === 'function') await settingsService.update(NS, merged, rev)
      } else if (scope) {
        if (typeof scope.replace === 'function') await scope.replace(merged)
        else if (typeof scope.patch === 'function') await scope.patch(merged)
        else if (typeof scope.set === 'function') {
          for (const [k, v] of Object.entries(merged)) await scope.set(k, v).catch(() => {})
        }
      }
    },
  })
  registerServerTools(ctx, { live, baseConfig, transcribe, polishText })
}
