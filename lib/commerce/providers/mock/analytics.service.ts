import { hasConsent } from "@/lib/consent";
import type { AnalyticsEvent, AnalyticsService } from "@/lib/commerce/types";

/**
 * Mirrors commerce events onto `window.dataLayer` — the de facto standard array GTM/GA4 and
 * most tag managers already read from. Swapping in a real provider means writing a new
 * adapter against this same interface; no call site changes.
 *
 * Every push is gated on analytics consent (QA-029). dataLayer is only an array in memory,
 * so pushing to it sets no cookie by itself — but the moment a tag manager is connected it
 * becomes the queue that tag manager drains, and anything already in it is sent
 * retroactively. Filling it for a visitor who declined would mean their behaviour is sitting
 * there waiting to be transmitted, which is not meaningfully different from tracking them.
 *
 * Checked per event rather than captured once: consent can be granted or withdrawn mid-session.
 */
export function createMockAnalyticsService(): AnalyticsService {
  const push = (payload: Record<string, unknown>) => {
    if (typeof window === "undefined") return;
    if (!hasConsent("analytics")) return;
    const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push(payload);
  };

  return {
    track(event: AnalyticsEvent) {
      push({ event: event.name, ...event.properties });
      if (process.env.NODE_ENV === "development") {
        console.debug("[analytics]", event.name, event.properties ?? {});
      }
    },

    identify(customerId: string, traits?: Record<string, unknown>) {
      push({ event: "identify", customerId, ...traits });
    },

    page(path: string, properties?: Record<string, unknown>) {
      push({ event: "page_view", path, ...properties });
    },
  };
}
