import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/App.tsx',
        'src/api/apiClient.ts',
        'src/components/ErrorBoundary.tsx',
        'src/features/statistics/StatisticsView.tsx',
        'src/i18n/index.ts',
        'src/utils/errorMessages.ts',
      ],
      exclude: ['**/*.json', 'src/test/**', 'dist/**', 'e2e/**'],
      thresholds: {
        statements: 95,
        lines: 95,
        functions: 95,
        branches: 75,
      },
    },
  },
})
