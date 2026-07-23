import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-session";
import { getCustomerById } from "@/services/customers";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * Always re-fetches the customer row fresh rather than trusting the JWT
 * payload's embedded email/name snapshot — preserves the mock's documented
 * "getSession() must re-hydrate from the live record" invariant (a profile/
 * address edit elsewhere must be visible here immediately, not just after
 * the 7-day-old cookie is reissued).
 */
export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ session: null });

  const customer = await getCustomerById(session.sub);
  if (!customer) return NextResponse.json({ session: null });

  return NextResponse.json({
    customer,
    token: "httponly",
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
  });
}
