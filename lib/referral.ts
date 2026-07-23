import { readStorage, writeStorage, removeStorage } from "@/lib/client-storage";

const REFERRAL_STORAGE_KEY = "alexandris_referral_code";
const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredReferral {
  code: string;
  capturedAt: number;
}

/** Called once on app mount (see components/shared/ReferralCapture.tsx) — a `?ref=` param on ANY landing page starts a 30-day attribution window, not just /account/register. */
export function captureReferralFromUrl(search: string): void {
  const code = new URLSearchParams(search).get("ref");
  if (!code) return;
  writeStorage<StoredReferral>(REFERRAL_STORAGE_KEY, { code: code.trim().toUpperCase(), capturedAt: Date.now() });
}

export function getStoredReferralCode(): string | null {
  const stored = readStorage<StoredReferral | null>(REFERRAL_STORAGE_KEY, null);
  if (!stored) return null;
  if (Date.now() - stored.capturedAt > REFERRAL_TTL_MS) {
    removeStorage(REFERRAL_STORAGE_KEY);
    return null;
  }
  return stored.code;
}

export function clearStoredReferralCode(): void {
  removeStorage(REFERRAL_STORAGE_KEY);
}
