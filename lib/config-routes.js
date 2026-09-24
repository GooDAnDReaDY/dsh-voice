// lib/config-routes.js — Host route for plugin configuration persistence over network.
// Solves DSH network limitation where client-side persistence is blocked in non-loopback environments (Gitea #149).

import { writeJson, readBody, isTrustedCaller } from './http-util.js'

export function registerConfigRoutes(ctx, {
  NS,
  live,
  getSettingsService,
  getScope,
  validateConfig,
  triggerAutostart,
}) {
  return ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-voice/config',
    handler: async (req, res) => {
      // 1. Method check: only GET, PUT, POST allowed
      if (req.method !== 'GET' && req.method !== 'PUT' && req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET, PUT, or POST only' } })
        return
      }

      // 2. Security check: loopback or same-origin
      if (!isTrustedCaller(req)) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden source origin' } })
        return
      }

      // 3. GET: return live configuration snapshot
      if (req.method === 'GET') {
        writeJson(res, 200, { ok: true, config: live() })
        return
      }

      // 4. PUT / POST: check settings service availability
      const settingsService = getSettingsService?.()
      const scope = getScope?.()
      if (!settingsService && !scope) {
        writeJson(res, 503, { ok: false, error: { code: 'unavailable', message: 'settings service not ready' } })
        return
      }

      // 5. Read request body
      let raw
      try {
        raw = await readBody(req, 1024 * 1024)
      } catch (e) {
        writeJson(res, 400, { ok: false, error: { code: 'body', message: e.message } })
        return
      }

      // 6. Parse JSON payload
      let payload
      try {
        payload = JSON.parse(raw.toString('utf8') || '{}')
      } catch {
        writeJson(res, 400, { ok: false, error: { code: 'json', message: 'invalid json' } })
        return
      }

      const rawConfig = payload && typeof payload.config === 'object' && payload.config !== null
        ? payload.config
        : payload

      if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
        writeJson(res, 400, { ok: false, error: { code: 'body', message: 'body must be a JSON object' } })
        return
      }

      // 7. Validate and merge configuration
      let merged
      try {
        const current = live() || {}
        const candidate = {
          ...current,
          ...rawConfig,
          dictation: { ...(current.dictation || {}), ...(rawConfig.dictation || {}) },
          message: { ...(current.message || {}), ...(rawConfig.message || {}) },
        }
        merged = validateConfig ? validateConfig(candidate) : candidate
      } catch (err) {
        writeJson(res, 400, { ok: false, error: { code: 'validation', message: String(err?.message || err) } })
        return
      }

      // 8. Persist to host settings
      try {
        let saved = false
        if (settingsService) {
          let rev
          try {
            rev = settingsService.describe?.()?.find?.((r) => r.ns === NS)?.revision
          } catch { /* ignore revision lookup errors */ }

          if (typeof settingsService.replace === 'function') {
            await settingsService.replace(NS, merged, rev)
            saved = true
          } else if (typeof settingsService.update === 'function') {
            await settingsService.update(NS, merged, rev)
            saved = true
          }
        }

        if (scope) {
          if (typeof scope.replace === 'function') {
            await scope.replace(merged)
            saved = true
          } else if (typeof scope.patch === 'function') {
            await scope.patch(merged)
            saved = true
          } else if (typeof scope.set === 'function') {
            for (const [k, v] of Object.entries(merged)) {
              await scope.set(k, v).catch(() => {})
            }
            saved = true
          }
        }

        if (!saved) {
          writeJson(res, 503, { ok: false, error: { code: 'unavailable', message: 'failed to persist settings' } })
          return
        }

        if (typeof triggerAutostart === 'function') {
          triggerAutostart()
        }

        writeJson(res, 200, { ok: true, config: live() })
      } catch (err) {
        writeJson(res, 500, { ok: false, error: { code: 'save', message: String(err?.message || err) } })
      }
    },
  })
}