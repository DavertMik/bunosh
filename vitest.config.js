import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['e2e-tests/**/*.spec.js'],
    testTimeout: 30000, // 30s for e2e tests
    hookTimeout: 10000,
    teardownTimeout: 10000,
  },
});