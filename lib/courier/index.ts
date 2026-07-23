import "server-only";
import { createManualCourierProvider } from "@/lib/courier/providers/manual";
import { createAcsCourierProvider } from "@/lib/courier/providers/acs";
import type { CourierProvider } from "@/lib/courier/types";

export * from "@/lib/courier/types";
export { buildTrackingUrl, ACS_CARRIER_NAME } from "@/lib/courier/tracking-url";

/** Same single-switch-statement pattern as lib/commerce/index.ts / lib/email/index.ts. */
export function getCourierProvider(): CourierProvider {
  const providerName = process.env.COURIER_PROVIDER ?? "manual";
  switch (providerName) {
    case "acs": {
      const apiKey = process.env.ACS_API_KEY;
      const companyId = process.env.ACS_COMPANY_ID;
      const companyPassword = process.env.ACS_COMPANY_PASSWORD;
      const userId = process.env.ACS_USER_ID;
      const userPassword = process.env.ACS_USER_PASSWORD;
      const billingCode = process.env.ACS_BILLING_CODE;
      if (!apiKey || !companyId || !companyPassword || !userId || !userPassword || !billingCode) {
        console.warn("[courier] COURIER_PROVIDER=acs but ACS_* credentials are not fully set — falling back to manual provider.");
        return createManualCourierProvider();
      }
      return createAcsCourierProvider({ apiKey, companyId, companyPassword, userId, userPassword, billingCode });
    }
    case "manual":
    default:
      return createManualCourierProvider();
  }
}

export function isAcsCourierConfigured(): boolean {
  return process.env.COURIER_PROVIDER === "acs";
}
