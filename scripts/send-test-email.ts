import "dotenv/config";
import { Resend } from "resend";
import { welcomeEmail } from "@/lib/email/templates";
import { COMPANY } from "@/constants/company";

/**
 * Proves that transactional email actually leaves the building.
 *
 * The whole email stack (templates, providers, EmailLog, eleven call sites) has been
 * finished and untested since launch, because `EMAIL_PROVIDER` was never switched off
 * `dev` — and the dev provider writes a perfect-looking row to `EmailLog` and sends
 * nothing. The admin Emails page therefore looks identical whether real mail is going
 * out or not. That is the failure this script exists to catch: **a green EmailLog is
 * not evidence of delivery.**
 *
 *   npx tsx scripts/send-test-email.ts you@yourdomain.com
 *
 * It deliberately re-implements the switch in `buildEmailProvider()` rather than
 * importing it: `lib/email/index.ts` is `server-only`, which throws outside a Next
 * server runtime. Keep the two in step — if they disagree, this script's verdict is
 * worthless. It also does NOT write to `EmailLog`; a connection test is not an order
 * confirmation and should not appear in the shop's audit trail.
 *
 * The message sent is the real `welcomeEmail` template, unmodified, so what lands in
 * the inbox is what a customer sees — masthead, serif display type, CTA button and all.
 * Send it to yourself: until a domain is verified in Resend, your own account address
 * is the only recipient Resend will accept anyway.
 */
async function main() {
  const recipient = process.argv[2];
  if (!recipient || !recipient.includes("@")) {
    console.error("Usage: npx tsx scripts/send-test-email.ts <recipient@example.com>");
    process.exit(1);
  }

  const providerName = process.env.EMAIL_PROVIDER ?? "dev";
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  console.log(`EMAIL_PROVIDER   ${providerName}`);
  console.log(`RESEND_API_KEY   ${apiKey ? `set (${apiKey.slice(0, 8)}…, ${apiKey.length} chars)` : "NOT SET"}`);
  console.log(`EMAIL_FROM       ${from ?? "NOT SET"}`);
  console.log("");

  if (providerName !== "resend") {
    console.error(`EMAIL_PROVIDER is "${providerName}", so the app is using the dev provider:`);
    console.error('every email is written to EmailLog and none is sent. Set EMAIL_PROVIDER="resend".');
    process.exit(1);
  }

  if (!apiKey || !from) {
    console.error("EMAIL_PROVIDER=resend but RESEND_API_KEY/EMAIL_FROM are missing.");
    console.error("lib/email/index.ts would log this and SILENTLY FALL BACK to the dev provider —");
    console.error("the shop would keep running and no customer would ever receive mail.");
    process.exit(1);
  }

  const message = welcomeEmail({
    siteName: COMPANY.brandName,
    firstName: "Test",
    shopUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  });

  const { data, error } = await new Resend(apiKey).emails.send({
    from,
    to: recipient,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  if (error) {
    console.error(`FAILED — ${error.name}: ${error.message}`);
    const hint = explain(error.name, error.message, from);
    if (hint) console.error(`\n${hint}`);
    process.exit(1);
  }

  console.log(`Sent to ${recipient} — Resend message id ${data?.id}`);
  console.log("Check the inbox, and https://resend.com/emails for the delivery status.");
  console.log("A 'sent' status that never arrives is usually SPF/DKIM: verify the domain in Resend.");
}

/** Turns Resend's terse error names into the thing that is actually misconfigured. */
function explain(name: string, detail: string, from: string): string | null {
  if (name === "validation_error" && detail.includes("testing emails")) {
    return [
      "Resend only lets an unverified account mail its OWN signup address.",
      "Either send this test to that address, or verify a domain you control at",
      "https://resend.com/domains and set EMAIL_FROM to an address on it.",
    ].join("\n");
  }
  if (name === "invalid_api_key" || name === "restricted_api_key") {
    return "The key in RESEND_API_KEY is wrong, revoked, or lacks send permission. Re-issue it at https://resend.com/api-keys.";
  }
  if (detail.includes("domain is not verified") || name === "not_found") {
    return [
      `The domain in EMAIL_FROM (${from}) is not verified in Resend.`,
      "Note that a *.vercel.app host can never be verified — you do not control its DNS.",
      "Use a domain you own, or Resend's shared onboarding@resend.dev for testing only.",
    ].join("\n");
  }
  return null;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
