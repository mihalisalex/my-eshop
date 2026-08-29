import { NextResponse } from "next/server";
import { refreshInstagramToken } from "@/services/instagram";

/**
 * Keeps the Instagram feed alive.
 *
 * A long-lived Instagram token expires 60 days after it is issued, and once it has actually
 * expired there is no refreshing it — someone has to walk back through Meta's consent screen
 * by hand. This endpoint exists so that never has to happen: each call extends the token by
 * another 60 days and stores the new one.
 *
 * Daily rather than weekly, for two unrelated reasons that agree. Meta only requires the
 * token to be at least 24 hours old, so daily is permitted; and Vercel's Hobby plan runs
 * cron jobs at most once a day, so a weekly schedule is not portable across the plan
 * decision this shop has not made yet. Refreshing a token that has 59 days left costs one
 * HTTP request.
 *
 * Same authorization as the other cron route: Vercel sends `Authorization: Bearer
 * <CRON_SECRET>`, and checking it is what stops an arbitrary public request from churning
 * the shop's credentials on demand.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  // An unset secret must never mean "open" — reject outright rather than matching
  // literal "Bearer undefined".
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await refreshInstagramToken();

  // 200 either way. A shop with no Instagram connected is not a failing cron job, and
  // neither is Meta being briefly unavailable — the reason is in the body and the runtime
  // logs. A non-2xx here would page someone over a homepage decoration.
  return NextResponse.json(result);
}
