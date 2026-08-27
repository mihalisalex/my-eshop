import "server-only";
import { createDevEmailProvider } from "@/lib/email/providers/dev";
import { createResendEmailProvider } from "@/lib/email/providers/resend";
import type { EmailProvider } from "@/lib/email/types";

export * from "@/lib/email/types";
export * from "@/lib/email/templates";

/**
 * Same single-switch-statement pattern as `lib/commerce/index.ts`'s
 * `getCommerceProvider()` — everything else only ever imports from here.
 * `EMAIL_PROVIDER=resend` requires `RESEND_API_KEY` + `EMAIL_FROM` in `.env`
 * (see `.env.example`); falls back to `dev` (logs to `EmailLog`, sends nothing
 * real) if the key is missing, so an unconfigured environment never throws.
 *
 * The value is lower-cased and trimmed before matching, and an unrecognised one
 * warns. `EMAIL_PROVIDER=Resend` previously fell through to `default` and sent
 * every order confirmation nowhere, in total silence — the mismatched branch
 * never reached the warning inside `case "resend"`, and the dev provider still
 * wrote a well-formed `EmailLog` row for each one, so the admin Emails page
 * showed a full outbox for mail that did not exist. A capital letter should not
 * be the difference between a shop that mails its customers and one that doesn't.
 */
function buildEmailProvider(): EmailProvider {
  const configured = process.env.EMAIL_PROVIDER?.trim();
  const providerName = configured ? configured.toLowerCase() : "dev";
  switch (providerName) {
    case "resend": {
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.EMAIL_FROM;
      if (!apiKey || !from) {
        console.warn("[email] EMAIL_PROVIDER=resend but RESEND_API_KEY/EMAIL_FROM are not set — falling back to dev provider.");
        return createDevEmailProvider();
      }
      return createResendEmailProvider({ apiKey, from });
    }
    case "dev":
      return createDevEmailProvider();
    default:
      if (configured) {
        console.warn(`[email] EMAIL_PROVIDER="${configured}" is not a known provider — falling back to dev provider. NO EMAIL WILL BE SENT.`);
      }
      return createDevEmailProvider();
  }
}

let cachedProvider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (!cachedProvider) cachedProvider = buildEmailProvider();
  return cachedProvider;
}
