// Transcript polish. Pure factory: inject fetch, key resolver, LLM, config.
// On any failure return the original text — polish must never block input.

/**
 * @param {object} deps
 * @param {(ref: string) => Promise<string>} deps.resolveKey
 * @param {typeof fetch} deps.fetchImpl
 * @param {() => object} deps.getConfig live plugin config
 * @param {{ stream: Function } | null} deps.llm harness LLM service (optional)
 * @param {() => ({provider: string, model: string} | null)} [deps.getAgentDefaultModel]
 */
export function createPolishText({ resolveKey, fetchImpl, getConfig, llm, getAgentDefaultModel }) {
  return async function polishText(text, modeCfg, signal) {
    const enable = modeCfg && (modeCfg.polish === true || modeCfg.polishSend === true)
    if (!enable || !text) return text
    const cfg = getConfig() || {}
    const ask =
      'Fix the punctuation and spelling of this dictated text and split it into '
      + 'paragraphs where the speaker changes topic. Remove filler words ("um", "uh", '
      + '"ээ", "ну", "как бы"). Keep the original language, wording and meaning. '
      + 'Reply with the polished text only:\n\n' + text
    try {
      // Local OpenAI-compatible endpoint when configured.
      if (cfg.polishBaseUrl) {
        const headers = { 'content-type': 'application/json' }
        if (cfg.polishKeyEnv) {
          const key = await resolveKey(cfg.polishKeyEnv)
          if (key) headers.authorization = 'Bearer ' + key
        }
        const res = await fetchImpl(
          String(cfg.polishBaseUrl).replace(/\/+$/, '') + '/chat/completions',
          {
            method: 'POST',
            headers,
            signal,
            body: JSON.stringify({
              model: cfg.polishModel || 'local-model',
              messages: [{ role: 'user', content: ask }],
            }),
          },
        )
        if (!res.ok) return text
        const data = await res.json().catch(() => null)
        const pick = data && data.choices && data.choices[0] && data.choices[0].message
          && data.choices[0].message.content
        return (pick && String(pick).trim()) || text
      }
      // Harness model.
      if (!llm || typeof llm.stream !== 'function') return text
      const sel = (typeof getAgentDefaultModel === 'function' && getAgentDefaultModel()) || null
      const provider = cfg.polishProvider || (sel && sel.provider) || ''
      const model = cfg.polishModelId || (sel && sel.model) || ''
      if (!provider || !model) return text
      let acc = ''
      // Lazy import keeps this module free of peer-dep imports at load time
      // for the local-endpoint path (the common offline case).
      const { createUserMessage } = await import('@deepseek-ai/dsh-llm')
      for await (const chunk of llm.stream({
        provider,
        model,
        messages: [createUserMessage({ content: [{ type: 'text', text: ask }], source: { kind: 'user' } })],
        signal,
      })) {
        if (chunk && chunk.type === 'text-delta' && typeof chunk.text === 'string') acc += chunk.text
      }
      const clean = acc.trim()
      return clean || text
    } catch {
      return text
    }
  }
}