/// <reference types="vite/client" />

export {}

declare global {
  interface Window {
    __BIRDNET_CONFIG__?: Partial<Record<string, string>>
  }
}
