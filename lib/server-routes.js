// HTTP and WebSocket route registration with explicit RouteDeps contract (#304)
import { registerHostRoutes } from './host-routes.js'
import { registerPluginUpdater } from './updater.js'
import { registerSensevoiceInstaller } from './sensevoice-installer.js'
import { registerConfigRoutes } from './config-routes.js'
import { sessionCommand } from './transcribe-core.js'
import { applyJargonDictionary, extractVoiceActions } from './normalize.js'
import { KNOWN_KEYS } from './providers.js'
import { BaseConfig } from './schema.js'

export function registerServerRoutes(ctx, deps) {
  const {
    NS = 'dsh-voice',
    live,
    daemons,
    statsTracker,
    transcribe,
    polishText,
    getSettingsService,
    getScope,
    updateConfig,
    triggerAutostart,
    manifestUrl = new URL('../package.json', import.meta.url),
  } = deps

  registerHostRoutes(ctx, {
    live,
    daemons,
    statsTracker,
    transcribe,
    polishText,
    sessionCommand,
    extractVoiceActions,
    applyJargonDictionary,
    KNOWN_KEYS,
  })

  ctx.effect(() => registerPluginUpdater(ctx, {
    endpoint: '/api/dsh-voice/update',
    packageName: '@goodandready/dsh-voice',
    manifestUrl,
  }), 'dsh-voice: updater route')

  ctx.effect(() => registerSensevoiceInstaller(ctx, {
    liveConfig: live,
    isAlive: daemons.sensevoiceAlive,
    updateConfig,
    startSensevoice: daemons.startSensevoice,
  }), 'dsh-voice: sensevoice installer route')

  ctx.effect(() => registerConfigRoutes(ctx, {
    NS,
    live,
    getSettingsService,
    getScope,
    validateConfig: (val) => BaseConfig(structuredClone(val)),
    triggerAutostart,
  }), 'dsh-voice: config route')
}
