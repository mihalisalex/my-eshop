/**
 * Local, static feature-flag registry. `isFeatureEnabled` is synchronous and works in
 * both server and client components — that's what a real flag provider (LaunchDarkly,
 * GrowthBook, Statsig) would change: this file's contents would become an async fetch
 * against that provider's SDK, cached per-request, with the same function signature so
 * no call site changes. A/B testing hooks are the same shape one level up — an
 * experiment returns a variant key instead of a boolean.
 */
export type FeatureFlag = "express-checkout" | "klarna-payment" | "magic-link-auth";

const FLAGS: Record<FeatureFlag, boolean> = {
  "express-checkout": true,
  "klarna-payment": true,
  "magic-link-auth": true,
};

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FLAGS[flag];
}
