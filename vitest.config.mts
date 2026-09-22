import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    hookTimeout: 60_000,
    include: ['tests/int/**/*.int.spec.ts', 'src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
