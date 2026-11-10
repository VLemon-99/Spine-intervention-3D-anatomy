import { defineConfig } from 'vitest/config';

// Unit tests run in plain Node (no browser stand-in such as jsdom/happy-dom).
// Screen tests (tests/e2e/) are run by Playwright, not Vitest.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
