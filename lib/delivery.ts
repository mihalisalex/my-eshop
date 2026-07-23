const WEEKDAY_FORMAT = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return result;
}

/** Renders a friendly "Arrives X – Y" estimate from today, given a min/max business-day window. */
export function getDeliveryEstimate(minDays: number, maxDays: number, from: Date = new Date()): string {
  const start = addBusinessDays(from, minDays);
  const end = addBusinessDays(from, maxDays);
  return `${WEEKDAY_FORMAT.format(start)} – ${WEEKDAY_FORMAT.format(end)}`;
}
