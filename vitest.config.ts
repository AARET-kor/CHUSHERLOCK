import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**", ".next-e2e/**", ".claude/**"],
    testTimeout: 15_000,
  },
});
