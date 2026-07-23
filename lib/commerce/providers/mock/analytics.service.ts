import type { AnalyticsEvent, AnalyticsService } from "@/lib/commerce/types";

/**
 * Mock analytics — logs to the console and mirrors events onto `window.dataLayer` (the
 * de facto standard array GTM/GA4 and most tag managers already read from). Swapping in
 * a real provider means writing a new adapter against this same interface; no call site
 * changes.
 */
export function createMockAnalyticsService(): AnalyticsService {
  const push = (payload: Record<string, unknown>) => {
    if (typeof window === "undefined") return;
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
