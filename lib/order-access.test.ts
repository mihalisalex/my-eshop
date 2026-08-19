import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { MAX_GRANTED_ORDERS, readOrderAccess, signOrderAccess, withGrantedOrder } from "./order-access";

const ORIGINAL = process.env.CUSTOMER_SESSION_SECRET;

beforeEach(() => {
  process.env.CUSTOMER_SESSION_SECRET = "a-test-secret-that-is-long-enough";
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CUSTOMER_SESSION_SECRET;
  else process.env.CUSTOMER_SESSION_SECRET = ORIGINAL;
});

describe("withGrantedOrder", () => {
  it("puts the newest order first", () => {
    expect(withGrantedOrder(["a"], "b")).toEqual(["b", "a"]);
  });

  it("does not duplicate an order placed again", () => {
    expect(withGrantedOrder(["a", "b"], "a")).toEqual(["a", "b"]);
  });

  it("trims the oldest, never the one just placed", () => {
    const existing = Array.from({ length: MAX_GRANTED_ORDERS }, (_, i) => `old-${i}`);
    const next = withGrantedOrder(existing, "new");
    expect(next).toHaveLength(MAX_GRANTED_ORDERS);
    expect(next[0]).toBe("new");
    expect(next).not.toContain(`old-${MAX_GRANTED_ORDERS - 1}`);
  });
});

describe("order access grant", () => {
  it("round-trips the granted ids", async () => {
    const token = await signOrderAccess(["order_1", "order_2"]);
    expect(await readOrderAccess(token)).toEqual(["order_1", "order_2"]);
  });

  it("reads nothing from a missing token", async () => {
    expect(await readOrderAccess(undefined)).toEqual([]);
  });

  it("reads nothing from a forged token", async () => {
    const token = await signOrderAccess(["order_1"]);
    // Same payload, signed with a different key — this is the whole point of the grant.
    process.env.CUSTOMER_SESSION_SECRET = "a-completely-different-test-secret";
    expect(await readOrderAccess(token)).toEqual([]);
  });

  it("reads nothing from a garbage token rather than throwing", async () => {
    expect(await readOrderAccess("not-a-jwt")).toEqual([]);
    expect(await readOrderAccess("a.b.c")).toEqual([]);
  });

  it("never signs more than the cap, so the cookie cannot grow unbounded", async () => {
    const many = Array.from({ length: MAX_GRANTED_ORDERS + 5 }, (_, i) => `order-${i}`);
    const token = await signOrderAccess(many);
    expect(await readOrderAccess(token)).toHaveLength(MAX_GRANTED_ORDERS);
  });
});
