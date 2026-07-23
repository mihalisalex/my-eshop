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
 */
function buildEmailProvider(): EmailProvider {
  const providerName = process.env.EMAIL_PROVIDER ?? "dev";
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
    default:
      return createDevEmailProvider();
  }
}

let cachedProvider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (!cachedProvider) cachedProvider = buildEmailProvider();
  return cachedProvider;
}
