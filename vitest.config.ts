import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    testTimeout: 15_000,
  },
});
