/**
 * Local, static feature-flag registry. `isFeatureEnabled` is synchronous and works in
 * both server and client components — that's what a real flag provider (LaunchDarkly,
 * GrowthBook, Statsig) would change: this file's contents would become an async fetch
 * against that provider's SDK, cached per-request, with the same function signature so
 * no call site changes. A/B testing hooks are the same shape one level up — an
 * experiment returns a variant key instead of a boolean.
 */
/*
 * "express-checkout" and "klarna-payment" were removed when the real payment
 * architecture landed. Both gated placeholder UI (buttons that toasted "not
 * connected in this demo", a "Pay in 4" option with no provider behind it) —
 * exactly the kind of thing a payment method registry is supposed to replace.
 * Wallets and BNPL are now real payment methods whose visibility comes from the
 * admin's own configuration via GET /api/payment-methods, not from a flag in
 * source control.
 */
export type FeatureFlag = "magic-link-auth";

const FLAGS: Record<FeatureFlag, boolean> = {
  "magic-link-auth": true,
};

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FLAGS[flag];
}
