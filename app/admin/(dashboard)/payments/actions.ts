"use server";

import { revalidatePath } from "next/cache";
import { capabilityDenied, getAdminSession } from "@/lib/admin-session";
import { cancelPayment, confirmManualPayment, refundPayment, verifyPaymentWithProvider } from "@/services/payments";
import { PaymentError } from "@/lib/payments/types";

/**
 * Payment mutations, each gated on the narrowest capability that fits what it does.
 *
 * The split is not bureaucratic: `payments:manage` says "the shop has this money",
 * which is an accounting statement; `payments:refund` moves money back out, usually
 * through a live provider API, and can't be undone. An editor who can dispatch
 * orders should not be able to do either.
 */
export interface PaymentActionState {
  error?: string;
  success?: string;
}

function revalidatePayment(paymentId: string) {
  revalidatePath(`/admin/payments/${paymentId}`);
  revalidatePath("/admin/payments");
  // Order pages surface the payment status too, so they'd otherwise show a stale one.
  revalidatePath("/admin/orders", "layout");
}

/** Turns a PaymentError into its shopper-safe message; anything else into a generic one, with the detail logged. */
function toActionError(error: unknown, fallback: string): string {
  if (error instanceof PaymentError) return error.message;
  console.error("[payments] admin action failed", error);
  return fallback;
}

export async function confirmManualPaymentAction(paymentId: string, note?: string): Promise<PaymentActionState> {
  const denied = await capabilityDenied("payments:manage");
  if (denied) return { error: denied };
  const session = await getAdminSession();

  try {
    await confirmManualPayment(paymentId, session?.sub ?? "unknown", note);
  } catch (error) {
    return { error: toActionError(error, "Could not confirm this payment.") };
  }
  revalidatePayment(paymentId);
  return { success: "Payment marked as received." };
}

export async function cancelPaymentAction(paymentId: string, reason?: string): Promise<PaymentActionState> {
  const denied = await capabilityDenied("payments:manage");
  if (denied) return { error: denied };
  const session = await getAdminSession();

  try {
    await cancelPayment(paymentId, session?.sub ?? "unknown", reason);
  } catch (error) {
    return { error: toActionError(error, "Could not cancel this payment.") };
  }
  revalidatePayment(paymentId);
  return { success: "Payment cancelled." };
}

export async function refundPaymentAction(
  paymentId: string,
  amount: number,
  reason?: string
): Promise<PaymentActionState> {
  const denied = await capabilityDenied("payments:refund");
  if (denied) return { error: denied };
  const session = await getAdminSession();

  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a refund amount greater than zero." };

  try {
    await refundPayment(paymentId, amount, session?.sub ?? "unknown", reason);
  } catch (error) {
    return { error: toActionError(error, "Could not process this refund.") };
  }
  revalidatePayment(paymentId);
  return { success: "Refund recorded." };
}

/**
 * Re-asks the provider what the truth is. Available to anyone who can view payments
 * — it's a read that writes only what the provider itself reports, so it can't be
 * used to assert a status the provider doesn't agree with.
 */
export async function refreshPaymentStatusAction(paymentId: string): Promise<PaymentActionState> {
  const denied = await capabilityDenied("payments:view");
  if (denied) return { error: denied };

  try {
    await verifyPaymentWithProvider(paymentId);
  } catch (error) {
    return { error: toActionError(error, "Could not refresh this payment.") };
  }
  revalidatePayment(paymentId);
  return { success: "Status refreshed from the provider." };
}
