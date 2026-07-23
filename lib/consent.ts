const CONSENT_KEY = "alexandris_cookie_consent";

export type ConsentCategory = "analytics" | "marketing";

export interface ConsentChoice {
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
}

export function getConsentChoice(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    return raw ? (JSON.parse(raw) as ConsentChoice) : null;
  } catch {
    return null;
  }
}

export function setConsentChoice(choice: Omit<ConsentChoice, "decidedAt">): void {
  if (typeof window === "undefined") return;
  const value: ConsentChoice = { ...choice, decidedAt: new Date().toISOString() };
  window.localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
}

/**
 * The gate any future analytics/marketing script must check before loading — no
 * such script exists in this app today (see PROGRESS.md's roadmap), so this is
 * currently unused by any real integration, but it's the real seam, not a stub:
 * essential cookies (cart id, session, this consent choice itself) never need it.
 */
export function hasConsent(category: ConsentCategory): boolean {
  return getConsentChoice()?.[category] ?? false;
}
