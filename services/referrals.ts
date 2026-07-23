import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getEmailProvider, referralRewardEmail } from "@/lib/email";
import { getSiteSettings } from "@/services/settings";

const REWARD_AMOUNT = 15;
const REWARD_CURRENCY = "EUR";

/** Lazily generated, never regenerated once set — a customer's referral link stays stable forever. */
export async function getOrCreateReferralCode(customerId: string): Promise<string> {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
  if (customer.referralCode) return customer.referralCode;

  const code = `${customer.firstName.slice(0, 3).toUpperCase()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  await prisma.customer.update({ where: { id: customerId }, data: { referralCode: code } });
  return code;
}

/**
 * Called from sign-up — best-effort, never blocks account creation. No-ops silently
 * if the code doesn't match any customer (an invalid/stale link shouldn't error the
 * signup) or if the code is the new customer's own (can't refer yourself).
 */
export async function recordReferralSignup(referralCode: string, referredCustomerId: string): Promise<void> {
  const referrer = await prisma.customer.findUnique({ where: { referralCode: referralCode.toUpperCase() } });
  if (!referrer || referrer.id === referredCustomerId) return;

  await prisma.referral.create({
    data: { referrerCustomerId: referrer.id, referredCustomerId },
  });
}

/**
 * Called from services/checkout.ts's completeCheckout after a successful order —
 * best-effort, never blocks the order. Rewards on whichever order completes first
 * while the referral is still "pending" (the unique constraint on referredCustomerId
 * means this can only ever fire once per referred customer).
 */
export async function rewardReferralIfPending(referredCustomerId: string): Promise<void> {
  const referral = await prisma.referral.findUnique({
    where: { referredCustomerId },
    include: { referrer: true, referred: true },
  });
  if (!referral || referral.status !== "pending") return;

  const giftCardCode = `REF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  await prisma.$transaction([
    prisma.giftCard.create({
      data: { code: giftCardCode, balanceAmount: REWARD_AMOUNT, currencyCode: REWARD_CURRENCY },
    }),
    prisma.referral.update({
      where: { id: referral.id },
      data: { status: "rewarded", rewardGiftCardCode: giftCardCode, rewardedAt: new Date() },
    }),
  ]);

  const settings = await getSiteSettings();
  const message = referralRewardEmail({
    siteName: settings.siteName,
    firstName: referral.referrer.firstName,
    friendFirstName: referral.referred.firstName,
    giftCardCode,
    giftCardAmount: { amount: REWARD_AMOUNT, currencyCode: REWARD_CURRENCY },
  });
  await getEmailProvider().send({ to: referral.referrer.email, template: "referral-reward", ...message });
}

export interface ReferralSummary {
  id: string;
  referredFirstName: string;
  status: "pending" | "rewarded";
  rewardGiftCardCode?: string;
  createdAt: string;
}

export async function getReferralsForCustomer(customerId: string): Promise<ReferralSummary[]> {
  const rows = await prisma.referral.findMany({
    where: { referrerCustomerId: customerId },
    include: { referred: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    referredFirstName: row.referred.firstName,
    status: row.status as "pending" | "rewarded",
    rewardGiftCardCode: row.rewardGiftCardCode ?? undefined,
    createdAt: row.createdAt.toISOString(),
  }));
}

export interface AdminReferralRow {
  id: string;
  referrerName: string;
  referrerEmail: string;
  referredName: string;
  status: "pending" | "rewarded";
  rewardGiftCardCode?: string;
  createdAt: string;
}

export async function getAllReferralsForAdmin(): Promise<AdminReferralRow[]> {
  const rows = await prisma.referral.findMany({
    include: { referrer: true, referred: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    referrerName: `${row.referrer.firstName} ${row.referrer.lastName}`,
    referrerEmail: row.referrer.email,
    referredName: `${row.referred.firstName} ${row.referred.lastName}`,
    status: row.status as "pending" | "rewarded",
    rewardGiftCardCode: row.rewardGiftCardCode ?? undefined,
    createdAt: row.createdAt.toISOString(),
  }));
}
