import { configDefaults, defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    passWithNoTests: true,
    setupFiles: ['@testing-library/jest-dom/vitest'],
    // Claude Code worktrees are full checkouts of other branches; their tests
    // belong to those branches and fail against this one's code.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
