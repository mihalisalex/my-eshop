import { describe, it, expect } from "vitest";
import { buildShippingRates, computeShippingChargeForRate, resolveShippingRate } from "./shipping";
import shippingFallback from "@/data/shipping.json";
import type { ShippingSettings } from "@/types";

/**
 * Built from the shipped defaults rather than from literals, so these tests exercise the same
 * configuration a fresh install runs on. The threshold and prices are read back off the
 * settings instead of being repeated here — a test that hardcodes 150 keeps passing after
 * someone changes the default to 100 and stops describing the shop.
 */
const DEFAULTS = shippingFallback as ShippingSettings;
const THRESHOLD = DEFAULTS.freeShippingThreshold!;
const RATES = buildShippingRates(DEFAULTS);
const STANDARD = RATES.find((rate) => rate.id === "standard")!;
const EXPRESS = RATES.find((rate) => rate.id === "express")!;

describe("buildShippingRates", () => {
  it("folds the threshold onto free-eligible rates only", () => {
    expect(STANDARD.freeOverAmount).toBe(THRESHOLD);
    expect(EXPRESS.freeOverAmount).toBeNull();
  });

  it("drops disabled rates so a shopper is never offered one that cannot be picked", () => {
    const settings: ShippingSettings = {
      ...DEFAULTS,
      rates: DEFAULTS.rates.map((rate) => (rate.id === "express" ? { ...rate, enabled: false } : rate)),
    };
    expect(buildShippingRates(settings).map((rate) => rate.id)).toEqual(["standard"]);
  });

  it("carries no threshold at all when free shipping is switched off", () => {
    const settings: ShippingSettings = { ...DEFAULTS, freeShippingThreshold: null };
    const standard = buildShippingRates(settings).find((rate) => rate.id === "standard")!;
    expect(standard.freeOverAmount).toBeNull();
    expect(computeShippingChargeForRate(standard, 10_000, true)).toBe(standard.price.amount);
  });
});

describe("resolveShippingRate", () => {
  it("returns the picked rate", () => {
    expect(resolveShippingRate(RATES, "express")?.id).toBe("express");
  });

  it("falls back to the first rate for an unknown or absent id", () => {
    // A rate can be disabled between a cart being built and its checkout completing; the
    // order still has to price against something rather than throwing at the till.
    expect(resolveShippingRate(RATES, "no-such-rate")?.id).toBe("standard");
    expect(resolveShippingRate(RATES)?.id).toBe("standard");
  });

  it("returns undefined when no rate is configured at all", () => {
    expect(resolveShippingRate([], "standard")).toBeUndefined();
  });
});

describe("computeShippingChargeForRate", () => {
  it("charges Express its full listed price even over the free-shipping threshold", () => {
    expect(computeShippingChargeForRate(EXPRESS, THRESHOLD + 50, true)).toBe(EXPRESS.price.amount);
  });

  it("charges Standard under the threshold", () => {
    expect(computeShippingChargeForRate(STANDARD, THRESHOLD - 1, true)).toBe(STANDARD.price.amount);
  });

  it("regression: an explicitly selected Standard rate stays free at/over the threshold (past revenue bug — see PROGRESS.md)", () => {
    expect(computeShippingChargeForRate(STANDARD, THRESHOLD, true)).toBe(0);
    expect(computeShippingChargeForRate(STANDARD, THRESHOLD + 50, true)).toBe(0);
  });

  it("is free with no active items regardless of rate", () => {
    expect(computeShippingChargeForRate(EXPRESS, 500, false)).toBe(0);
  });
});
