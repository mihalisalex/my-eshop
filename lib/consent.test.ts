import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getConsentChoice, hasConsent, onConsentChange, setConsentChoice } from "./consent";

/**
 * The gate every analytics script passes through (QA-029). The property that matters is
 * that it fails CLOSED — a visitor who has not answered the banner must not be measured,
 * because under GDPR/ePrivacy "they didn't say no" is not consent.
 *
 * `window` is stubbed rather than pulling in jsdom: this module touches exactly two browser
 * APIs (localStorage and the event target), so a real DOM would be a large dependency for a
 * surface this small, and the project's devDependencies are deliberately lean.
 */
function stubWindow() {
  const bus = new EventTarget();
  const store = new Map<string, string>();

  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
    // Bound, because EventTarget's methods need their real receiver.
    addEventListener: bus.addEventListener.bind(bus),
    removeEventListener: bus.removeEventListener.bind(bus),
    dispatchEvent: bus.dispatchEvent.bind(bus),
  });

  return store;
}

let store: Map<string, string>;

beforeEach(() => {
  store = stubWindow();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hasConsent", () => {
  it("denies when no choice has been made", () => {
    expect(hasConsent("analytics")).toBe(false);
    expect(hasConsent("marketing")).toBe(false);
  });

  it("denies when the visitor declined", () => {
    setConsentChoice({ analytics: false, marketing: false });
    expect(hasConsent("analytics")).toBe(false);
  });

  it("allows only the category that was granted", () => {
    setConsentChoice({ analytics: true, marketing: false });
    expect(hasConsent("analytics")).toBe(true);
    expect(hasConsent("marketing")).toBe(false);
  });

  it("denies when the stored value is corrupt, rather than throwing", () => {
    store.set("alexandris_cookie_consent", "{not json");
    expect(getConsentChoice()).toBeNull();
    expect(hasConsent("analytics")).toBe(false);
  });

  it("denies on the server, where there is no window at all", () => {
    vi.unstubAllGlobals();
    expect(hasConsent("analytics")).toBe(false);
  });
});

describe("onConsentChange", () => {
  it("notifies the tab that made the change", () => {
    // The whole point: a `storage` event fires in OTHER tabs, so without this the visit
    // that produced the consent is the one visit that goes unmeasured.
    const listener = vi.fn();
    onConsentChange(listener);

    setConsentChoice({ analytics: true, marketing: false });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ analytics: true, marketing: false });
  });

  it("reports withdrawal as well as granting", () => {
    const listener = vi.fn();
    onConsentChange(listener);

    setConsentChoice({ analytics: true, marketing: true });
    setConsentChoice({ analytics: false, marketing: false });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0]).toMatchObject({ analytics: false });
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = onConsentChange(listener);
    unsubscribe();

    setConsentChoice({ analytics: true, marketing: true });

    expect(listener).not.toHaveBeenCalled();
  });

  it("records when the decision was made", () => {
    setConsentChoice({ analytics: true, marketing: false });
    const stored = getConsentChoice();
    expect(stored?.decidedAt).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(stored!.decidedAt))).toBe(false);
  });
});
