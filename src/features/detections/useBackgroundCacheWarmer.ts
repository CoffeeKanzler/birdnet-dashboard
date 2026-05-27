import { useEffect } from 'react'
import { buildApiUrl } from '../../api/apiClient'

export function useBackgroundCacheWarmer(enabled = true): void {
  useEffect(() => {
    if (!enabled || import.meta.env.VITE_DEMO_MODE === 'true') {
      return
    }

    const summaryUrl = buildApiUrl('/api/v2/summary/30d')
    const recentUrl = buildApiUrl('/api/v2/detections/recent', new URLSearchParams({ limit: '30' }))
    const controller = new AbortController()
    void fetch(summaryUrl, { signal: controller.signal, cache: 'no-store' }).catch(() => {})
    void fetch(recentUrl, { signal: controller.signal, cache: 'no-store' }).catch(() => {})

    return () => {
      controller.abort()
    }
  }, [enabled])
}
