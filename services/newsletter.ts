import "server-only";
import { prisma } from "@/lib/prisma";
import type { NewsletterSubscriber } from "@/types";

/**
 * Real newsletter persistence. This replaced a form that awaited a 500ms timer and
 * then claimed success while discarding the address — the footer signup (sitewide)
 * and the homepage Newsletter section both went through it, so every subscriber
 * collected up to this point was silently dropped.
 */

/**
 * Idempotent by email: re-subscribing updates nothing and reports the same success as a
 * first-time signup. That keeps a double-submit from erroring, and deliberately makes
 * "already subscribed" indistinguishable from "newly subscribed" to the caller, so the
 * endpoint can't be used to test whether an address is on the list.
 */
export async function subscribeToNewsletter(email: string, source?: string): Promise<void> {
  await prisma.newsletterSubscriber.upsert({
    where: { email },
    create: { email, source },
    update: {},
  });
}

export async function getNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
  const rows = await prisma.newsletterSubscriber.findMany({ orderBy: { subscribedAt: "desc" } });
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    source: row.source ?? undefined,
    subscribedAt: row.subscribedAt.toISOString(),
  }));
}

export async function getNewsletterSubscriberCount(): Promise<number> {
  return prisma.newsletterSubscriber.count();
}
