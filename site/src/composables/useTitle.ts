import { watchEffect } from 'vue'

const BASE = '積累與感興'

export function useTitle(titleGetter?: () => string | undefined) {
  if (import.meta.env.SSR) return

  if (titleGetter) {
    watchEffect(() => {
      const t = titleGetter()
      document.title = t ? `${t} — ${BASE}` : BASE
    })
  }
}
