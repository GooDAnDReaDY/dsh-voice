// Subsystem facade for local STT daemons (#304)
import { createLocalDaemons } from './local-daemon.js'

export function createServerDaemons({ live, ctx }) {
  const daemons = createLocalDaemons({ live, ctx })
  if (typeof ctx?.effect === 'function') {
    ctx.effect(() => () => daemons.dispose(), 'dsh-voice: daemon cleanup')
  }
  return daemons
}
