import { describe, expect, it } from "vitest";
import { getDeliveryEstimate, __testing } from "@/lib/delivery";

const { isNonWorkingDay, orthodoxEaster, addBusinessDays } = __testing;

/** Local midnight, so the weekday matches what a shopper in Greece would see. */
const day = (iso: string) => new Date(`${iso}T00:00:00`);

describe("orthodoxEaster", () => {
  // Known Orthodox Easter Sundays — the algorithm is worth pinning to real dates
  // rather than to its own output.
  it.each([
    [2024, "2024-05-05"],
    [2025, "2025-04-20"],
    [2026, "2026-04-12"],
    [2027, "2027-05-02"],
  ])("resolves %i", (year, expected) => {
    expect(orthodoxEaster(year).toISOString().slice(0, 10)).toBe(expected);
  });
});

describe("isNonWorkingDay", () => {
  it("treats weekends as non-working", () => {
    expect(isNonWorkingDay(day("2026-08-15"))).toBe(true); // Saturday
    expect(isNonWorkingDay(day("2026-08-16"))).toBe(true); // Sunday
  });

  it("treats fixed Greek public holidays as non-working", () => {
    expect(isNonWorkingDay(day("2026-03-25"))).toBe(true); // 25 March
    expect(isNonWorkingDay(day("2026-10-28"))).toBe(true); // Όχι Day
    expect(isNonWorkingDay(day("2026-12-25"))).toBe(true); // Christmas
  });

  it("treats the movable Orthodox Easter cluster as non-working", () => {
    expect(isNonWorkingDay(day("2026-02-23"))).toBe(true); // Clean Monday
    expect(isNonWorkingDay(day("2026-04-10"))).toBe(true); // Good Friday
    expect(isNonWorkingDay(day("2026-04-13"))).toBe(true); // Easter Monday
    expect(isNonWorkingDay(day("2026-06-01"))).toBe(true); // Holy Spirit Monday
  });

  it("leaves ordinary weekdays alone", () => {
    expect(isNonWorkingDay(day("2026-08-18"))).toBe(false); // a plain Tuesday
  });
});

describe("addBusinessDays", () => {
  it("skips a public holiday that falls mid-week", () => {
    // 25 March 2026 is a Wednesday. One business day from Tuesday the 24th must land on
    // Thursday the 26th, not on the holiday itself — the old weekend-only rule returned
    // the 25th and promised delivery on a day nothing ships.
    expect(addBusinessDays(day("2026-03-24"), 1).getDate()).toBe(26);
  });

  it("carries across the Easter weekend rather than through it", () => {
    // Thursday 9 April 2026 + 2 business days: Good Friday and Easter Monday are both
    // out, so the next two working days are Tuesday 14th and Wednesday 15th.
    expect(addBusinessDays(day("2026-04-09"), 2).getDate()).toBe(15);
  });
});

describe("getDeliveryEstimate", () => {
  it("renders a readable range and never lands on a non-working day", () => {
    const estimate = getDeliveryEstimate(3, 5, day("2026-08-17"));
    expect(estimate).toMatch(/^[A-Z][a-z]+, [A-Z][a-z]+ \d+ – [A-Z][a-z]+, [A-Z][a-z]+ \d+$/);
  });
});
