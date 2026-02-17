import { useEffect } from 'react'

const SUMMARY_WARM_URL = '/api/v2/summary/30d'
const RECENT_WARM_URL = '/api/v2/detections/recent?limit=30'

export function useBackgroundCacheWarmer(enabled = true): void {
  useEffect(() => {
    if (!enabled) {
      return
    }

    const controller = new AbortController()
    // Keep warm-up cheap: one summary call and one recent call.
    void fetch(SUMMARY_WARM_URL, { signal: controller.signal, cache: 'no-store' }).catch(() => {})
    void fetch(RECENT_WARM_URL, { signal: controller.signal, cache: 'no-store' }).catch(() => {})

    return () => {
      controller.abort()
    }
  }, [enabled])
}
