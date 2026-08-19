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

/**
 * Fired on the window whenever the choice changes.
 *
 * Without it, granting consent would only take effect on the next full page load: the
 * shopper clicks "Accept All", nothing happens, and the visit that produced the consent is
 * the one visit that goes unmeasured. `storage` events are no use here — they fire in OTHER
 * tabs, not the one that made the change.
 */
export const CONSENT_CHANGED_EVENT = "alexandris:consent-changed";

export function setConsentChoice(choice: Omit<ConsentChoice, "decidedAt">): void {
  if (typeof window === "undefined") return;
  const value: ConsentChoice = { ...choice, decidedAt: new Date().toISOString() };
  window.localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_CHANGED_EVENT, { detail: value }));
}

/** Subscribe to consent changes. Returns an unsubscribe function. */
export function onConsentChange(listener: (choice: ConsentChoice) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => listener((event as CustomEvent<ConsentChoice>).detail);
  window.addEventListener(CONSENT_CHANGED_EVENT, handler);
  return () => window.removeEventListener(CONSENT_CHANGED_EVENT, handler);
}

/**
 * The gate every analytics/marketing script must pass before loading.
 *
 * Fails CLOSED: no stored choice means no consent, so a visitor who has not answered the
 * banner is not measured. That is the only reading compatible with GDPR/ePrivacy, under
 * which analytics cookies need prior consent — "they didn't say no" is not consent.
 *
 * Essential cookies (cart id, sessions, and this choice itself) never consult this.
 */
export function hasConsent(category: ConsentCategory): boolean {
  return getConsentChoice()?.[category] ?? false;
}
