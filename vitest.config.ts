import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
