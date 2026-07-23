/**
 * Public tracking-page URL by carrier name — independent of which CourierProvider
 * created the shipment. Links to ACS's general track-and-trace page rather than a
 * deep link with the voucher number pre-filled: ACS's real tracking page is a
 * Liferay portlet with portal-internal `p_p_*` parameters, not a documented simple
 * query-string API, so guessing a `?number=`-style deep link risked shipping a link
 * that silently 404s or lands on the wrong state. The admin/customer pastes the
 * tracking number into ACS's own search box on that page — one extra click, but a
 * link that's honestly verified to go somewhere real. Revisit if ACS documents a
 * real deep-link format later.
 */
export function buildTrackingUrl(carrier: string): string | undefined {
  const normalized = carrier.trim().toLowerCase();
  if (normalized === "acs courier" || normalized === "acs") {
    return "https://www.acscourier.net/en/track-and-trace";
  }
  return undefined;
}

export const ACS_CARRIER_NAME = "ACS Courier";
