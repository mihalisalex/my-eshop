import "server-only";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import type { EmailMessage, EmailProvider } from "@/lib/email/types";

/**
 * Real sending via Resend, still logged to `EmailLog` (same as the dev provider) so
 * the admin Emails page keeps working as the audit trail regardless of provider.
 * A send failure throws — callers already wrap every `.send()` call in try/catch
 * (order confirmation, shipping updates, password reset, welcome) so a Resend outage
 * degrades to "no email sent" rather than failing the underlying order/action.
 */
export function createResendEmailProvider(input: { apiKey: string; from: string }): EmailProvider {
  const resend = new Resend(input.apiKey);
  return {
    async send(message: EmailMessage) {
      const { error } = await resend.emails.send({
        from: input.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      if (error) throw new Error(`Resend send failed: ${error.message}`);

      await prisma.emailLog.create({
        data: {
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          template: message.template,
        },
      });
    },
  };
}
