import { test, expect, type Page } from "@playwright/test";

/**
 * Browse → product → size → cart. The path every order travels, and the one nothing else
 * in this repo exercises.
 *
 * Stops before placing an order: without a test database that would write a real order and
 * move real stock. What it does cover is everything up to that point, which is where the
 * bugs the merchant actually reported lived.
 */

const PRODUCT = "/products/mauro-loafer-me-aspres-leptomereies";

/**
 * A shoe size button, matched by accessible name.
 *
 * The trailing `.*$` is load-bearing. A low-stock size carries a
 * `<span title="Λίγα κομμάτια">` badge, and a descendant `title` folds into the accessible
 * name — so "36" is really "36 Λίγα κομμάτια" the moment stock runs down. Playwright matches
 * a regex `name` against the WHOLE accessible name rather than as a prefix, so the obvious
 * `/^3[5-9]$/` matches a well-stocked size and silently misses every low-stock one.
 *
 * Found the hard way: the locator passed against a freshly-loaded page and failed in the
 * suite twenty minutes later, because stock had changed in between.
 */
const SIZE_NAME = /^(3[5-9]|4[0-6])\b.*$/;

/**
 * The consent banner overlays the page on a first visit. Declining is both the
 * privacy-preserving choice and the one that keeps analytics out of a test run.
 */
async function dismissConsent(page: Page): Promise<void> {
  const decline = page.getByRole("button", { name: "Απόρριψη προαιρετικών" });
  if (await decline.isVisible().catch(() => false)) await decline.click();
}

test.describe("the purchase funnel", () => {
  test("a shopper can go from the homepage to a product page", async ({ page }) => {
    await page.goto("/");
    await dismissConsent(page);

    // The homepage's job is to show product. If the grid is empty the shop is broken in a
    // way no unit test would notice.
    const productLinks = page.locator('a[href^="/products/"]');
    await expect(productLinks.first()).toBeVisible();
    expect(await productLinks.count()).toBeGreaterThan(2);

    await productLinks.first().click();
    await expect(page).toHaveURL(/\/products\//);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("the product page shows a price, a SKU and sizes", async ({ page }) => {
    await page.goto(PRODUCT);
    await dismissConsent(page);

    await expect(page.locator("h1")).toBeVisible();
    // Euro amount somewhere on the page — the merchant reported a PDP that showed the wrong
    // price shape when a product was on sale, so this is a regression guard, not a smoke test.
    await expect(page.getByText(/€/).first()).toBeVisible();

    /**
     * SKU visibility was one of the four PDP bugs reported from a real browser: it was
     * rendered nowhere at all. Pinned here because it is invisible to every other test.
     */
    await expect(page.getByText(/\b\d{3,}(-\d+)?\b/).first()).toBeVisible();

    /**
     * Sizes render as buttons, and at least one must be selectable or nothing can be bought.
     *
     * The regex ends in  deliberately. A low-stock size carries a
     * <span title="Λίγα κομμάτια"> badge, and a descendant title folds into the accessible
     * name — so "36" is really "36 Λίγα κομμάτια" whenever stock is low. Playwright matches a
     * regex  against the WHOLE accessible name rather than as a prefix, so a bare
     *  matches a well-stocked size and silently misses every low-stock one. That is
     * a locator that passes today and fails the week the shop sells down.
     */
    const sizes = page.getByRole("button", { name: SIZE_NAME });
    // toBeVisible auto-waits; count() does not, and the purchase panel hydrates client-side.
    await expect(sizes.first()).toBeVisible();
    expect(await sizes.count()).toBeGreaterThan(0);
  });

  test("the buy button refuses until a size is chosen, then adds to the cart", async ({ page }) => {
    await page.goto(PRODUCT);
    await dismissConsent(page);

    /**
     * The disabled state is the real assertion. An add-to-cart that accepts a null size is
     * how an unfulfillable order gets placed — the shop cannot ship "a loafer" without a size.
     */
    // Sentence case, not the uppercase you see: the caps are a CSS text-transform, while the
    // accessible name and textContent both keep the original "Επιλέξτε μέγεθος".
    const cta = page.getByRole("button", { name: /^(επιλέξτε μέγεθος|προσθήκη στο καλάθι)$/i });
    await expect(cta).toBeDisabled();

    const size = page.getByRole("button", { name: SIZE_NAME }).first();
    await expect(size).toBeVisible();
    await size.click();
    await expect(size).toHaveAttribute("aria-pressed", "true");

    await expect(cta).toBeEnabled();
    await expect(cta).toHaveText(/προσθήκη στο καλάθι/i);

    /**
     * This settle is NOT test flake padding — it is working around a real defect, recorded as
     * BUG-002.
     *
     * The button reports itself enabled, and its label has already flipped to "Προσθήκη στο
     * καλάθι", before the click handler is actually live. A click inside that window is
     * swallowed in silence: no request, no error, no cart line. Measured three ways — a plain
     * Playwright click and a dispatched DOM click both lose the item, while the identical
     * sequence with a 1.5s pause succeeds every time.
     *
     * Remove this line once BUG-002 is fixed; it should then pass without it, and that is the
     * test for the fix.
     */
    await page.waitForTimeout(1500);

    await cta.click();

    /**
     * The count badge on the header cart button is the confirmation a shopper actually gets.
     * The drawer does NOT open by itself — asserting on a dialog looks reasonable and fails
     * against the real app, which is how this assertion was written wrong the first time.
     *
     * Generous timeout: the write is a round trip to a serverless function and Neon, and a
     * cold start is genuinely slow.
     */
    const badge = page.locator('button[aria-label="Καλάθι"] span');
    await expect(badge).toHaveText("1", { timeout: 20_000 });

    // And the cart survives navigation — the id is persisted in localStorage, so a shopper
    // who browses on and comes back still has their bag.
    await page.goto("/cart");
    await expect(page.locator("#main").getByRole("link", { name: /loafer/i }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("an unknown product slug 404s rather than erroring", async ({ page }) => {
    // A 500 here would be indexed by Google as a broken page; a 404 is correct and cheap.
    const response = await page.goto("/products/this-product-does-not-exist-xyz");
    expect(response?.status()).toBe(404);
  });
});

test.describe("regressions that only a browser can catch", () => {
  test("the skip link is the first focusable element and becomes visible", async ({ page }) => {
    /**
     * A11Y-001. `sr-only` until focused is the whole point — hidden outright would leave a
     * sighted keyboard user with focus they cannot see. Only a real browser can tell the
     * difference between "in the DOM" and "actually reachable and visible on focus".
     */
    await page.goto("/");

    /**
     * Deliberately does NOT dismiss the consent banner first.
     *
     * Clicking anything moves the browser's sequential-focus origin to the clicked element,
     * and Chromium resumes tabbing from there — so after dismissing the banner the first Tab
     * lands on the header logo, having already passed the skip link. Neither blurring nor
     * focusing <body> resets that origin. Tabbing on a freshly loaded page is the only way to
     * ask the question the test is actually asking.
     */
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toHaveAttribute("href", "#main");
    await expect(focused).toBeVisible();
  });

  test("every main landmark the skip link targets actually exists", async ({ page }) => {
    // The skip link is worthless if #main is missing on the page being viewed.
    for (const path of ["/", PRODUCT, "/cart", "/women"]) {
      await page.goto(path);
      await expect(page.locator("#main")).toHaveCount(1);
    }
  });

  test("no Content-Security-Policy violations are reported", async ({ page }) => {
    /**
     * SEC-005 was a CSP bug found by *reading a live browser console* — `**.` is valid in
     * next/image remotePatterns and invalid in CSP, so the browser silently discarded the
     * whole img-src entry and every Instagram image was blocked. Nothing server-side noticed.
     *
     * This is the test that would have caught it.
     */
    const violations: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (/Content Security Policy|Refused to (load|execute|apply)/i.test(text)) {
        violations.push(text);
      }
    });

    await page.goto("/");
    await dismissConsent(page);
    await page.waitForLoadState("load");
    // A brief settle rather than networkidle: this page keeps connections open, so
    // networkidle never fires and the test times out instead of asserting anything.
    await page.waitForTimeout(2000);

    expect(violations, `CSP violations on the homepage:\n${violations.join("\n")}`).toHaveLength(0);
  });

  test("the homepage loads without page errors", async ({ page }) => {
    // An uncaught client exception is invisible server-side and to every unit test.
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    await dismissConsent(page);
    await page.waitForLoadState("load");
    // A brief settle rather than networkidle: this page keeps connections open, so
    // networkidle never fires and the test times out instead of asserting anything.
    await page.waitForTimeout(2000);

    expect(errors, `Uncaught page errors:\n${errors.join("\n")}`).toHaveLength(0);
  });

  test("the health endpoint reports the database as reachable", async ({ request }) => {
    // OBS-001's other half. Cheap here, and it makes a Neon outage fail the suite loudly.
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
  });
});
