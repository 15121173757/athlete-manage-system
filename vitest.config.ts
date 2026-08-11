import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['lib/modules/health/HealthService.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
});
