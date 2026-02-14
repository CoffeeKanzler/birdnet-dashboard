import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, new URL('.', import.meta.url).pathname, '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api/rarity': {
          target: 'https://api.ebird.org/v2',
          changeOrigin: true,
          secure: true,
          headers: {
            'X-eBirdApiToken': env.EBIRD_API_TOKEN,
          },
        },
      },
    },
  }
})
