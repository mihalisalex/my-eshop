import { NextResponse } from "next/server";
import { runDataRetention } from "@/services/data-retention";
import { logger } from "@/lib/logger";

/**
 * Scheduled deletion of personal data past its retention window (PRIV-001).
 *
 * Same authorization as the other crons: Vercel sends `Authorization: Bearer <CRON_SECRET>`
 * to the path in vercel.json, and an unset secret rejects outright rather than matching a
 * literal "Bearer undefined" — an open endpoint here would let anyone erase the forensic
 * record of every recent webhook.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    return NextResponse.json(await runDataRetention());
  } catch (error) {
    // A retention pass that fails silently is how indefinite retention comes back.
    logger.error("Data retention pass failed", error);
    return NextResponse.json({ error: "Data retention failed." }, { status: 500 });
  }
}
