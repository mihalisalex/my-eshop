import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Node environment, no React/JSX plugin — the initial test suite only covers
 * pure TS functions (lib/shipping.ts, lib/commerce/postgres/cart-totals.ts).
 * The "server-only" alias is required: cart-totals.ts imports "server-only"
 * at module level, which throws outside Next's own build (Next substitutes
 * it for the package's empty.js via a "react-server" export condition that
 * plain Vitest/Node doesn't set) — pointing the import straight at that same
 * empty.js sidesteps it without touching the source file.
 */
export default defineConfig({
  test: {
    environment: "node",
    /**
     * Loads .env so tests that talk to the real database (services/concurrency-guards.test.ts)
     * can find DATABASE_URL. Vitest does not read .env on its own, and without this those
     * tests SKIP rather than fail — the worst outcome, since a skipped guard test looks
     * exactly like a passing one in the summary.
     */
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.ts"],
    // e2e/ holds Playwright specs. Vitest would collect them and fail on the missing
    // Playwright runner, so the two suites are kept strictly apart.
    exclude: ["**/node_modules/**", "e2e/**"],
  },
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
      "@": path.resolve(__dirname, "."),
    },
  },
});
