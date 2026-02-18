import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dayCacheKey, getDayCachedPage, setDayCachedPage } from './dayCache'

type MockStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  clear: () => void
}

const createStorage = (): MockStorage => {
  const store = new Map<string, string>()

  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    clear: () => {
      store.clear()
    },
  }
}

describe('dayCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-18T12:00:00.000Z'))

    const storage = createStorage()
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
    })
  })

  it('stores and reads non-today ranges without TTL', () => {
    const payload = {
      detections: [{ id: '1' } as never],
      total: 1,
    }

    setDayCachedPage('2026-01-01', '2026-01-02', 0, payload)

    const key = dayCacheKey('2026-01-01', '2026-01-02', 0)
    const raw = globalThis.localStorage.getItem(key)
    expect(raw).toBeTruthy()

    const parsed = JSON.parse(raw ?? '{}') as { expiresAt?: number }
    expect(parsed.expiresAt).toBeUndefined()

    expect(getDayCachedPage('2026-01-01', '2026-01-02', 0)).toEqual(payload)
  })

  it('expires today-inclusive ranges after short TTL', () => {
    const payload = {
      detections: [{ id: '2' } as never],
      total: 1,
    }

    setDayCachedPage('2026-02-18', '2026-02-18', 0, payload)
    expect(getDayCachedPage('2026-02-18', '2026-02-18', 0)).toEqual(payload)

    vi.advanceTimersByTime(10 * 60_000 + 1)
    expect(getDayCachedPage('2026-02-18', '2026-02-18', 0)).toBeNull()
  })

  it('returns null for malformed cache payloads', () => {
    const key = dayCacheKey('2026-01-01', '2026-01-01', 0)
    globalThis.localStorage.setItem(key, '{"bad":true}')

    expect(getDayCachedPage('2026-01-01', '2026-01-01', 0)).toBeNull()
  })
})
