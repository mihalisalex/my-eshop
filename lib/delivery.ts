const WEEKDAY_FORMAT = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });

/**
 * Greek public holidays, as MM-DD for the fixed ones plus the movable Orthodox Easter
 * cluster resolved per year.
 *
 * The estimate used to count business days as "any day that isn't Saturday or Sunday",
 * which quietly overpromises around exactly the dates that matter most: nothing ships
 * over the Orthodox Easter weekend, and 15 August — the single biggest holiday in the
 * Greek calendar and the middle of the retail summer — was being counted as a working
 * day. Telling a customer their shoes arrive on a day no courier is operating is a
 * support ticket, not a rounding error.
 *
 * Deliberately a local table rather than a package: it is a dozen dates for one country,
 * and a real fulfilment integration (see lib/courier/) would get true cut-off and transit
 * times from the carrier instead of estimating at all.
 */
const FIXED_HOLIDAYS = new Set([
  "01-01", // Πρωτοχρονιά
  "01-06", // Θεοφάνεια
  "03-25", // Εικοστή Πέμπτη Μαρτίου
  "05-01", // Εργατική Πρωτομαγιά
  "08-15", // Κοίμηση της Θεοτόκου
  "10-28", // Επέτειος του Όχι
  "12-25", // Χριστούγεννα
  "12-26", // Σύναξη Θεοτόκου
]);

/** Meeus/Jones/Butcher Julian algorithm, shifted to the Gregorian calendar — Orthodox Easter. */
function orthodoxEaster(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  // The Julian date plus the 13-day offset that applies for 1900–2099.
  return new Date(Date.UTC(year, month - 1, day + 13));
}

function movableHolidays(year: number): Set<number> {
  const easter = orthodoxEaster(year);
  const offsets = [
    -48, // Καθαρά Δευτέρα
    -2, // Μεγάλη Παρασκευή
    0, // Κυριακή του Πάσχα
    1, // Δευτέρα του Πάσχα
    50, // Αγίου Πνεύματος
  ];
  return new Set(
    offsets.map((offset) => {
      const date = new Date(easter);
      date.setUTCDate(date.getUTCDate() + offset);
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    })
  );
}

const movableCache = new Map<number, Set<number>>();

function isNonWorkingDay(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return true;

  const monthDay = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  if (FIXED_HOLIDAYS.has(monthDay)) return true;

  const year = date.getFullYear();
  let movable = movableCache.get(year);
  if (!movable) {
    movable = movableHolidays(year);
    movableCache.set(year, movable);
  }
  return movable.has(Date.UTC(year, date.getMonth(), date.getDate()));
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (!isNonWorkingDay(result)) added += 1;
  }
  return result;
}

/** Renders a friendly "Arrives X – Y" estimate from today, given a min/max business-day window. */
export function getDeliveryEstimate(minDays: number, maxDays: number, from: Date = new Date()): string {
  const start = addBusinessDays(from, minDays);
  const end = addBusinessDays(from, maxDays);
  return `${WEEKDAY_FORMAT.format(start)} – ${WEEKDAY_FORMAT.format(end)}`;
}

/** Exported for tests — the working-day rule is the part worth pinning down. */
export const __testing = { isNonWorkingDay, orthodoxEaster, addBusinessDays };
