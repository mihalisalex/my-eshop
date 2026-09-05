import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { addOneToCart, dismissConsent, PRODUCT } from "./helpers";

/**
 * Automated accessibility scanning (A11Y-001's second half).
 *
 * The audit scored Accessibility 80 and said the next gains need a real audit pass with a
 * screen reader. That is still true — axe cannot tell you whether a page makes *sense* read
 * aloud, and roughly half of WCAG is not machine-checkable. What it does catch, on every page,
 * every run, is the half that is: missing form labels, insufficient contrast, broken heading
 * order, controls with no accessible name, duplicate landmark roles.
 *
 * Scoped to WCAG 2.1 A and AA, which is the level Greek and EU accessibility rules point at,
 * rather than every best-practice rule axe ships with — a suite that fails on advisory rules
 * gets muted, and a muted suite protects nothing.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Every violation, formatted so a failure says what to fix rather than just a count. */
function describe(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]): string {
  return violations
    .map((v) => {
      const where = v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n      ");
      return `  [${v.impact ?? "unknown"}] ${v.id} — ${v.help}\n      ${where}\n      ${v.helpUrl}`;
    })
    .join("\n");
}

async function scan(page: import("@playwright/test").Page) {
  return new AxeBuilder({ page }).withTags(WCAG).analyze();
}

test.describe("accessibility — WCAG 2.1 A and AA", () => {
  for (const [name, path] of [
    ["the homepage", "/"],
    ["a product page", PRODUCT],
    ["a category listing", "/women"],
    ["the empty cart", "/cart"],
  ] as const) {
    test(`${name} has no automatically-detectable violations`, async ({ page }) => {
      await page.goto(path);
      await dismissConsent(page);
      // Let hydration finish: a control that gets its accessible name from client JS scans as
      // nameless if axe runs first, which is a false positive that trains people to ignore it.
      await page.waitForLoadState("load");
      await page.waitForTimeout(1500);

      const { violations } = await scan(page);
      expect(violations, `${violations.length} violation(s) on ${path}:\n${describe(violations)}`).toEqual([]);
    });
  }

  test("the cart with an item in it has no violations", async ({ page }) => {
    // Worth its own case: the empty cart renders almost nothing, so scanning only that would
    // miss the quantity stepper, the remove control and the code field — the interactive parts
    // most likely to be missing a label.
    await addOneToCart(page);
    await page.goto("/cart");
    await expect(page.locator("#main")).toContainText("Μερικό σύνολο", { timeout: 20_000 });
    await page.waitForTimeout(1000);

    const { violations } = await scan(page);
    expect(violations, `${violations.length} violation(s) on the filled cart:\n${describe(violations)}`).toEqual([]);
  });

  test("the checkout contact step has no violations", async ({ page }) => {
    // The highest-stakes form in the shop. An unlabelled field here does not merely annoy —
    // it stops someone completing a purchase.
    await addOneToCart(page);
    await page.goto("/checkout");
    await dismissConsent(page);
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1000);

    const { violations } = await scan(page);
    expect(violations, `${violations.length} violation(s) at checkout:\n${describe(violations)}`).toEqual([]);
  });
});
