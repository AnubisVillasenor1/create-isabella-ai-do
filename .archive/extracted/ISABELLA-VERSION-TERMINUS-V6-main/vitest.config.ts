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
  },
});