import { describe, expect, it } from "vitest";
import { ADMIN_SESSION_COOKIE_OPTIONS } from "@/lib/auth";
import { CUSTOMER_SESSION_COOKIE_OPTIONS } from "@/lib/customer-auth";

/**
 * Both session cookies were being set with `httpOnly`, `sameSite` and `path` but WITHOUT
 * `secure`, in five places that each repeated the policy by hand — while
 * lib/order-access-cookie.ts, a strictly less sensitive cookie, set it correctly.
 *
 * These assert the policy on the shared objects those five call sites now pass, which is
 * what makes the attributes impossible to omit at one site and not another.
 */
describe.each([
  ["admin session", ADMIN_SESSION_COOKIE_OPTIONS],
  ["customer session", CUSTOMER_SESSION_COOKIE_OPTIONS],
])("%s cookie", (_label, options) => {
  it("is httpOnly, so a script cannot read it", () => {
    expect(options.httpOnly).toBe(true);
  });

  it("is Secure in production and not in development", () => {
    // Conditional rather than always-on so http://localhost still works — the same
    // condition lib/order-access-cookie.ts uses. Under vitest NODE_ENV is "test".
    expect(options.secure).toBe(process.env.NODE_ENV === "production");
  });

  it("is SameSite=Lax, not Strict", () => {
    // Strict withholds the cookie on the cross-site top-level navigation a redirect-based
    // payment provider uses to return the shopper, which would sign them out mid-purchase.
    expect(options.sameSite).toBe("lax");
  });

  it("is scoped to the whole site and expires", () => {
    expect(options.path).toBe("/");
    expect(options.maxAge).toBeGreaterThan(0);
  });
});
