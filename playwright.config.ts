import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests for the purchase funnel (TEST-001, the remaining half).
 *
 * The audit's blunt lesson was that **both** post-audit findings — SEC-005 and BUG-001 —
 * came from running the app rather than reading it, and neither could have been caught by
 * any test that existed. 443 Vitest specs and not one of them opens a browser.
 *
 * Runs against the DEPLOYED site by default rather than a local dev server, which is
 * deliberate: a dev build has different CSP handling, different image behaviour and no
 * production env, so it cannot catch the class of bug that actually got through. Override
 * with E2E_BASE_URL to point at localhost.
 *
 * These tests stop SHORT of placing an order. Completing a purchase would write a real
 * order against the real catalogue and move real stock — the shop has no test database yet
 * (see the Deferred section of AUDIT.md). What they do write is a cart, which is exactly
 * what any visitor writes by browsing.
 */
export default defineConfig({
  testDir: "./e2e",
  // Sequential: the shop is a live site and there is no reason to hammer it.
  workers: 1,
  fullyParallel: false,
  // A flake here is a signal, not noise — retry once locally to tell one from the other.
  retries: process.env.CI ? 2 : 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://shopalexandris.vercel.app",
    // Greek locale: the shop is fully Greek and several assertions read Greek copy.
    locale: "el-GR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    /**
     * Mobile is not a nice-to-have here. The carousel padding bug and the PDP layout
     * problems the merchant reported were both viewport-dependent, and a desktop-only
     * suite would have been blind to them.
     */
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
