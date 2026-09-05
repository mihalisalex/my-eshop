import { expect, type Page } from "@playwright/test";

/** A product with several sizes in stock and a price that clears the free-shipping threshold in three. */
export const PRODUCT = "/products/mauro-loafer-me-aspres-leptomereies";

/**
 * A shoe size button, matched by accessible name.
 *
 * The trailing `.*$` is load-bearing. A low-stock size carries a
 * `<span title="Λίγα κομμάτια">` badge, and a descendant `title` folds into the accessible
 * name — so "36" is really "36 Λίγα κομμάτια" the moment stock runs down. Playwright matches
 * a regex `name` against the WHOLE accessible name rather than as a prefix, so the obvious
 * `/^3[5-9]$/` matches a well-stocked size and silently misses every low-stock one.
 */
export const SIZE_NAME = /^(3[5-9]|4[0-6])\b.*$/;

/**
 * Sentence case, not the uppercase you see. The caps are a CSS `text-transform`, while the
 * accessible name and `textContent` both keep the original "Επιλέξτε μέγεθος".
 */
export const BUY_NAME = /^(επιλέξτε μέγεθος|προσθήκη στο καλάθι)$/i;

/**
 * The consent banner overlays the page on a first visit. Declining is both the
 * privacy-preserving choice and the one that keeps analytics out of a test run.
 *
 * Note that clicking it moves the browser's sequential-focus origin, which matters for any
 * test that then presses Tab — see the skip-link spec.
 */
export async function dismissConsent(page: Page): Promise<void> {
  const decline = page.getByRole("button", { name: "Απόρριψη προαιρετικών" });
  if (await decline.isVisible().catch(() => false)) await decline.click();
}

/** The header cart badge — the count a shopper actually sees. Absent when the cart is empty. */
export function cartBadge(page: Page) {
  return page.locator('button[aria-label="Καλάθι"] span');
}

/**
 * A size with enough stock to raise the quantity — 38 carries three where 36 carries one.
 *
 * Any test that changes quantity has to ask for this explicitly, because the quantity control
 * is capped at what is actually in stock: picking the first available size lands on 36, whose
 * "increase" button is correctly disabled at one, and the test then fails looking like a bug.
 *
 * If a quantity test starts failing on the stepper being disabled, check stock before checking
 * the code — the shop may simply have sold down.
 */
export const ROOMY_SIZE = /^38\b.*$/;

/**
 * Puts one unit of `PRODUCT` in the cart and leaves the browser on the product page.
 *
 * Deliberately does NOT pause between picking a size and clicking buy: that pause used to be
 * required, and its absence is the standing regression test for BUG-002.
 */
export async function addOneToCart(page: Page, size: RegExp = SIZE_NAME): Promise<void> {
  await page.goto(PRODUCT);
  await dismissConsent(page);

  await page.getByRole("button", { name: size }).first().click();
  const buy = page.getByRole("button", { name: BUY_NAME });
  await expect(buy).toBeEnabled();
  await buy.click();

  // Generous on purpose: the write is a round trip to a serverless function and Neon, and a
  // cold start against production genuinely takes tens of seconds. 20s was not enough when
  // several specs ran back to back, which failed as a fake accessibility violation.
  await expect(cartBadge(page)).toHaveText("1", { timeout: 45_000 });
}

/** The cart page's totals block, as one whitespace-normalised string. */
export async function summaryText(page: Page): Promise<string> {
  const main = page.locator("#main");
  await expect(main).toContainText("Μερικό σύνολο", { timeout: 20_000 });
  return ((await main.innerText()) ?? "").replace(/\s+/g, " ");
}
