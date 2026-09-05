import { test, expect } from "@playwright/test";
import { ROOMY_SIZE, addOneToCart, cartBadge, dismissConsent, summaryText } from "./helpers";

/**
 * The cart and the first checkout step.
 *
 * These exist because of BUG-002. Its cause — `CartProvider` opening every mutation with
 * `if (!cart) return` — was not specific to add-to-cart: quantity changes, discount codes,
 * gift cards and clear-cart all shared the guard, so any of them fired early was dropped in
 * the same silence. All were fixed in one commit and only add-to-cart had a test, which left
 * the rest as unverified fixes to a bug class this shop has already shipped once.
 *
 * Stops before placing an order — there is no test database, and a real order would move real
 * stock. Everything up to that point is fair game, and it is where the merchant's own reported
 * bugs actually lived.
 */

test.describe("the cart", () => {
  test("raising the quantity updates the subtotal and the total", async ({ page }) => {
    await addOneToCart(page, ROOMY_SIZE);
    await page.goto("/cart");

    expect(await summaryText(page)).toContain("39 €");

    await page.locator('button[aria-label="Αύξηση ποσότητας"]').click();

    // 2 × €39. The assertion is on the recomputed money, not on the number in the stepper —
    // a quantity control that updates its own label and not the total is the failure worth
    // catching.
    await expect(page.locator("#main")).toContainText("78 €", { timeout: 20_000 });
  });

  test("free shipping starts at the threshold in settings, not a hardcoded figure", async ({ page }) => {
    /**
     * The merchant reported this one from a real browser: the storefront claimed free shipping
     * over €150 while the setting said €100, because the figure was hardcoded. The threshold
     * now comes from the shipping settings, and this pins it there.
     *
     * €39 × 3 = €117, which clears €100. Three is also this size's whole stock, so the
     * quantity control caps there — see the next test.
     */
    await addOneToCart(page, ROOMY_SIZE);
    await page.goto("/cart");

    expect(await summaryText(page)).toContain("4,95 €");

    const increase = page.locator('button[aria-label="Αύξηση ποσότητας"]');
    await increase.click();
    await expect(page.locator("#main")).toContainText("78 €", { timeout: 20_000 });
    await increase.click();
    await expect(page.locator("#main")).toContainText("117 €", { timeout: 20_000 });

    // Δωρεάν — free. The shipping line must change, not just the total.
    await expect(page.locator("#main")).toContainText("Δωρεάν", { timeout: 20_000 });
  });

  test("the quantity control stops at the stock actually available", async ({ page }) => {
    // The last line of defence in front of the oversell guard: the UI should not let a shopper
    // ask for more than exists, even though `completeCheckout` would refuse it anyway.
    await addOneToCart(page, ROOMY_SIZE);
    await page.goto("/cart");
    await summaryText(page);

    /**
     * Stepped deliberately, asserting the money after each click, rather than looping on
     * `isEnabled()`.
     *
     * The loop version passed alone and failed in a full run: the control is *also* disabled
     * for the moment a mutation is in flight, so the loop would read that transient state as
     * "capped", stop early, and then find the button enabled again. A flake that only appears
     * under load is worse than no test, because it teaches people to re-run rather than look.
     */
    const increase = page.locator('button[aria-label="Αύξηση ποσότητας"]');
    await increase.click();
    await expect(page.locator("#main")).toContainText("78 €", { timeout: 20_000 });
    await increase.click();
    await expect(page.locator("#main")).toContainText("117 €", { timeout: 20_000 });

    // Three is this size's entire stock, so the control must now refuse to go further.
    await expect(increase).toBeDisabled({ timeout: 20_000 });
  });

  test("removing the only line empties the cart", async ({ page }) => {
    await addOneToCart(page);
    await page.goto("/cart");
    await summaryText(page);

    await page.locator('button[aria-label="Αφαίρεση"]').first().click();

    await expect(page.locator("#main")).toContainText("άδειο", { timeout: 20_000 });
    // And the header badge goes with it, rather than stranding a count over an empty bag.
    await expect(cartBadge(page)).toHaveCount(0, { timeout: 20_000 });
  });

  test("an unknown discount code reports an error instead of doing nothing", async ({ page }) => {
    /**
     * The BUG-002 shape, on a different path. `applyCode` shared the `if (!cart) return`
     * guard, so a code entered too early was swallowed with no request and no message — which
     * to a shopper is indistinguishable from the code being wrong.
     *
     * A rejected code must SAY it was rejected. Silence is the bug.
     */
    await addOneToCart(page);
    await page.goto("/cart");
    await summaryText(page);

    await page.getByPlaceholder(/WELCOME10/).fill("NOPE-INVALID-XYZ");
    await page.getByRole("button", { name: /^εφαρμογή$/i }).click();

    await expect(page.getByRole("status").filter({ hasText: /Κάτι πήγε στραβά/ })).toBeVisible({
      timeout: 20_000,
    });
    // And the money is untouched by a failed code.
    await expect(page.locator("#main")).toContainText("43,95 €");
  });
});

test.describe("checkout, up to the point of paying", () => {
  test("the contact step refuses an invalid email and does not advance", async ({ page }) => {
    await addOneToCart(page);
    await page.goto("/checkout");
    await dismissConsent(page);

    const email = page.locator('input[name="email"]');
    await expect(email).toBeVisible({ timeout: 20_000 });

    await email.fill("not-an-email");
    await page.getByRole("button", { name: /συνέχεια στην αποστολή/i }).click();

    // Still on the contact step. An address form appearing here would mean a checkout can be
    // built on an address nobody can send a confirmation to.
    await expect(email).toBeVisible();
    await expect(page).toHaveURL(/\/checkout/);
  });

  test("a valid email advances to the shipping step", async ({ page }) => {
    await addOneToCart(page);
    await page.goto("/checkout");
    await dismissConsent(page);

    const email = page.locator('input[name="email"]');
    await expect(email).toBeVisible({ timeout: 20_000 });
    await email.fill("e2e-test@example.com");
    await page.getByRole("button", { name: /συνέχεια στην αποστολή/i }).click();

    // The shipping step asks for a delivery address; reaching it is the proof the contact
    // step accepted and persisted.
    await expect(page.locator("#main")).toContainText(/διεύθυνση|address/i, { timeout: 20_000 });
  });

  test("the order total carried into checkout matches the cart", async ({ page }) => {
    // Totals are recomputed server-side at checkout. A figure that changes between the cart
    // and the checkout summary is the kind of thing a shopper notices and does not forgive.
    await addOneToCart(page);
    await page.goto("/cart");
    expect(await summaryText(page)).toContain("43,95 €");

    await page.goto("/checkout");
    await dismissConsent(page);
    await expect(page.locator("#main")).toContainText("43,95 €", { timeout: 20_000 });
  });
});
