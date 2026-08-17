import { describe, expect, it } from "vitest";
import { CAPABILITIES, ROLE_CAPABILITIES, capabilitiesByGroup, roleHasCapability } from "@/constants/permissions";
import { ADMIN_ROLES } from "@/types/admin";

describe("capability model", () => {
  it("gives admin every capability — a new capability must never lock the owner out", () => {
    for (const capability of CAPABILITIES) {
      expect(roleHasCapability("admin", capability.key)).toBe(true);
    }
  });

  it("withholds the destructive and administrative capabilities from editors", () => {
    // These are the ones an editor silently had before enforcement existed.
    for (const capability of ["catalog:delete", "catalog:discounts", "admin:users", "admin:settings", "orders:returns", "content:publish", "content:navigation"] as const) {
      expect(roleHasCapability("editor", capability)).toBe(false);
    }
  });

  it("withholds every money-moving and credential-exposing payment capability from editors", () => {
    for (const capability of ["payments:manage", "payments:refund", "payments:configure"] as const) {
      expect(roleHasCapability("editor", capability)).toBe(false);
    }
  });

  it("still lets editors do their actual job", () => {
    // payments:view included deliberately — an editor has to know whether an order
    // has been paid for before dispatching it.
    for (const capability of ["catalog:view", "catalog:edit", "content:blog", "orders:view", "orders:manage", "payments:view"] as const) {
      expect(roleHasCapability("editor", capability)).toBe(true);
    }
  });

  it("grants no capability outside the declared list, for any role", () => {
    const declared = new Set(CAPABILITIES.map((c) => c.key));
    for (const role of ADMIN_ROLES) {
      for (const granted of ROLE_CAPABILITIES[role]) {
        expect(declared.has(granted)).toBe(true);
      }
    }
  });

  it("returns false for an unknown role rather than defaulting to allowed", () => {
    // Guards against a bad DB value being read as a promotion.
    expect(roleHasCapability("superuser" as never, "admin:users")).toBe(false);
  });

  it("exposes every capability through capabilitiesByGroup, so the roles page can't omit one", () => {
    const grouped = capabilitiesByGroup().flatMap((g) => g.capabilities.map((c) => c.key));
    expect(grouped.sort()).toEqual(CAPABILITIES.map((c) => c.key).sort());
  });
});
