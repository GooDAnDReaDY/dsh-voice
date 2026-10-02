import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

export function loadClientPlugin() {
  const code = fs.readFileSync(path.join(process.cwd(), 'lib/client.js'), 'utf8')
  let loaded = null
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load: (def) => {
          loaded = def.factory((mod) => {
            if (mod === 'react') return { createElement: () => ({}), useState: () => [false, () => {}], useEffect: () => {} }
            return {}
          })
        }
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    document: {
      documentElement: { lang: 'en' },
      querySelector: () => null,
      head: { appendChild: () => {} },
      createElement: () => ({ setAttribute: () => {}, dataset: {}, textContent: '' }),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    navigator: { language: 'en-US' },
    AbortController,
    fetch: () => Promise.resolve({ ok: true, json: async () => ({}) }),
    setTimeout,
    clearTimeout,
    Date,
    Math,
    console,
  }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox)
  return loaded
}
