import { generateId, readStorage, writeStorage } from "@/lib/client-storage";

/**
 * Extends `lib/feature-flags.ts`'s local-registry pattern one level up — an
 * experiment returns a variant key instead of a boolean, per that file's own doc
 * comment. Assignment is deterministic (hash of experiment key + visitor id), not
 * `Math.random()`, because a real assignment must stay stable for a given visitor
 * across renders and reloads,
 * which a per-call random draw can't guarantee. A real experimentation platform
 * (GrowthBook, Statsig, LaunchDarkly) would replace this file's internals with a
 * fetch against that provider while keeping the same `getVariant` signature.
 */
export type ExperimentKey = "homepage-hero-cta";
export type Variant = "control" | "variant";

const EXPERIMENTS: Record<ExperimentKey, readonly Variant[]> = {
  "homepage-hero-cta": ["control", "variant"],
};

const VISITOR_ID_KEY = "alexandris_experiment_visitor_id";

function hashToUnit(input: string): number {
  const hash = input.split("").reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 100000, 0);
  return hash / 100000;
}

export function getExperimentVisitorId(): string {
  const existing = readStorage<string | null>(VISITOR_ID_KEY, null);
  if (existing) return existing;
  const id = generateId("visitor");
  writeStorage(VISITOR_ID_KEY, id);
  return id;
}

export function getVariant(key: ExperimentKey, visitorId: string): Variant {
  const variants = EXPERIMENTS[key];
  const unit = hashToUnit(`${key}:${visitorId}`);
  const index = Math.min(variants.length - 1, Math.floor(unit * variants.length));
  return variants[index];
}
