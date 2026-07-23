import "server-only";
import { prisma } from "@/lib/prisma";
import type { EmailMessage, EmailProvider } from "@/lib/email/types";

/**
 * Doesn't call any real email API — writes to `EmailLog` instead, which the admin
 * Emails page reads back. Same "honest placeholder" pattern as the Express
 * Checkout / social-sign-in buttons elsewhere in this app: nothing pretends to
 * have sent real mail, but the full rendered content (subject/html/text) is
 * genuinely produced and genuinely persisted, not just console.log'd and
 * forgotten — swapping in a real provider (Resend/SendGrid/Postmark) later means
 * writing one more file here and changing `EMAIL_PROVIDER`, not touching any caller.
 */
export function createDevEmailProvider(): EmailProvider {
  return {
    async send(message: EmailMessage) {
      await prisma.emailLog.create({
        data: {
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          template: message.template,
        },
      });
      console.log(`[email:dev] ${message.template} -> ${message.to}: "${message.subject}"`);
    },
  };
}
