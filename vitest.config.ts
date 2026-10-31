import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    env: {
      BOOKPI_INTEGRITY_SECRET: "test-only-integrity-secret-never-production-2026",
      NODE_ENV: "test",
    },
    include: ["test/**/*.test.ts"],
    // Several suites import the full server module (heavy on Windows and shared runners)
    // and a few benchmark loops run 500+ samples. The defaults (5s/10s) are too tight.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Only used by `pnpm test:coverage` (needs @vitest/coverage-v8). No threshold is enforced until a baseline is measured in CI.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["src/**/*.ts"],
    },
  },
});