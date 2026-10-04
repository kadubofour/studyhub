import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import path from 'node:path'

export default defineConfig(() => ({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // `server-only` throws outside a Next server build; in tests it's just a marker
      'server-only': path.resolve(__dirname, 'tests/empty.ts'),
    },
  },
  test: {
    environment: 'node',
    env: loadEnv('test', process.cwd(), ''), // loads .env.test.local for DB tests
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    testTimeout: 20000,
  },
}))
