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
     * Mobile is not a nice-to-have here. The carousel padding bug and the PDP layout problems
     * the merchant reported were both viewport-dependent, and a desktop-only suite would have
     * been blind to them.
     *
     * Scoped to the funnel and the cart rather than everything. The accessibility scan is
     * viewport-independent for the rules it checks, and running it twice doubled the cart
     * churn described below for no extra signal.
     */
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /(purchase-funnel|cart-and-checkout)\.spec\.ts/,
    },
  ],
});

/**
 * ONE THING TO KNOW BEFORE RUNNING THIS REPEATEDLY AGAINST PRODUCTION.
 *
 * `CartProvider` creates a cart on first page load, so **every fresh browser context creates a
 * row** whether or not the test adds anything. `POST /api/cart` is rate limited to 60 per 10
 * minutes per IP (`app/api/cart/route.ts`), and a full run opens enough contexts to spend a
 * large part of that budget in one go.
 *
 * Two runs back to back will exhaust it, and the symptom is misleading: the cart bootstrap
 * silently never resolves, so tests fail on a missing cart badge and look like a product bug.
 * That is exactly how an hour went the first time — chased as a mobile-only defect, because
 * the mobile project runs second and inherits the empty budget.
 *
 * If a run fails on the badge, check `rate_limit_attempts` for `cart-create:ip:<yours>` before
 * suspecting the app, and wait out the ten-minute window.
 *
 * The limit is correct and should not be raised to suit the tests. It is worth knowing that
 * real shoppers behind one shared NAT share that budget too.
 */
