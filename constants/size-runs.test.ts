import { describe, expect, it } from "vitest";
import { SIZE_RUNS, expandSizeRun } from "@/constants/size-runs";

function totalPairs(id: string): number {
  const run = SIZE_RUNS.find((r) => r.id === id)!;
  return expandSizeRun(run).reduce((sum, size) => sum + size.quantity, 0);
}

describe("size runs", () => {
  it("each run holds the number of pairs its name claims", () => {
    // The label is what an owner checks against the delivery, so it has to be true.
    expect(totalPairs("A")).toBe(8);
    expect(totalPairs("B")).toBe(8);
    expect(totalPairs("C")).toBe(12);
  });

  it("A is the men's run, weighted to the middle sizes", () => {
    expect(expandSizeRun(SIZE_RUNS[0])).toEqual([
      { name: "40", quantity: 1 },
      { name: "41", quantity: 2 },
      { name: "42", quantity: 2 },
      { name: "43", quantity: 2 },
      { name: "44", quantity: 1 },
    ]);
  });

  it("B is the women's run, weighted the same way", () => {
    expect(expandSizeRun(SIZE_RUNS[1])).toEqual([
      { name: "36", quantity: 1 },
      { name: "37", quantity: 2 },
      { name: "38", quantity: 2 },
      { name: "39", quantity: 2 },
      { name: "40", quantity: 1 },
    ]);
  });

  it("C is B plus four more pairs across 38, 39, 40 and 41", () => {
    const b = new Map(expandSizeRun(SIZE_RUNS[1]).map((s) => [s.name, s.quantity]));
    const c = new Map(expandSizeRun(SIZE_RUNS[2]).map((s) => [s.name, s.quantity]));
    const extra = [...c].reduce((sum, [name, qty]) => sum + (qty - (b.get(name) ?? 0)), 0);
    expect(extra).toBe(4);
    expect(c.get("41")).toBe(1); // a size B does not carry at all
  });

  it("returns sizes ascending, matching how they are shown and positioned", () => {
    for (const run of SIZE_RUNS) {
      const names = expandSizeRun(run).map((s) => Number(s.name));
      expect(names).toEqual([...names].sort((a, b) => a - b));
    }
  });

  it("lists each size exactly once, however many pairs of it there are", () => {
    for (const run of SIZE_RUNS) {
      const names = expandSizeRun(run).map((s) => s.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("the written notation agrees with the run it documents", () => {
    // The notation is what gets read off a supplier sheet; if the two drift, the button
    // says one thing and does another.
    for (const run of SIZE_RUNS) {
      expect(run.notation.split("-").map(Number).sort((a, b) => a - b)).toEqual([...run.sizes].sort((a, b) => a - b));
    }
  });
});
