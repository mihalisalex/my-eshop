import { NextResponse } from "next/server";
import { runAbandonedCartRecovery, runReviewRequestFollowup } from "@/services/email-followups";

/**
 * Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` to the path
 * configured in vercel.json — verifying it here is what stops this endpoint being
 * triggerable by an arbitrary public request (which could spam customers with
 * recovery/review emails on demand).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  // An unset secret must never mean "open" — reject outright rather than matching
  // literal "Bearer undefined".
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const [abandonedCarts, reviewRequests] = await Promise.all([runAbandonedCartRecovery(), runReviewRequestFollowup()]);

  return NextResponse.json({ abandonedCarts, reviewRequests });
}
