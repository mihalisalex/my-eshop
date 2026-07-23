import "server-only";
import { CourierError, type CourierProvider, type CreateShipmentInput, type CreateShipmentResult } from "@/lib/courier/types";
import { ACS_CARRIER_NAME, buildTrackingUrl } from "@/lib/courier/tracking-url";

const ACS_BASE_URL = "https://webservices.acscourier.net/ACSRestServices/api/ACSAutoRest";

export interface AcsCredentials {
  apiKey: string;
  companyId: string;
  companyPassword: string;
  userId: string;
  userPassword: string;
  billingCode: string;
}

/**
 * Real ACS Courier REST API integration — `ACSAlias`/`ACSInputParameters` envelope,
 * `AcsApiKey` header, `Company_ID`/`Company_Password`/`User_ID`/`User_Password`/
 * `Billing_Code` auth fields, `ACS_Create_Voucher` method. Field names are sourced
 * from ACS's own published "ACS Rest API Web Services" guide + a working reference
 * implementation, since the PDF itself wasn't machine-readable at build time — **this
 * has not been exercised against a live ACS account**. Before relying on it for a
 * real shipment: place one test voucher, compare the actual response shape against
 * the parsing below (the error path surfaces the raw response body specifically so
 * a mismatch is immediately visible instead of silently mis-parsed), and adjust field
 * names against your account's real Swagger docs at
 * https://webservices.acscourier.net/ACSRestServices/swagger/ if anything differs.
 */
export function createAcsCourierProvider(creds: AcsCredentials): CourierProvider {
  async function call(alias: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch(ACS_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        AcsApiKey: creds.apiKey,
      },
      body: JSON.stringify({
        ACSAlias: alias,
        ACSInputParameters: {
          Company_ID: creds.companyId,
          Company_Password: creds.companyPassword,
          User_ID: creds.userId,
          User_Password: creds.userPassword,
          Billing_Code: creds.billingCode,
          ...params,
        },
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new CourierError(`ACS API returned ${res.status}: ${text.slice(0, 500)}`);
    }

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new CourierError(`ACS API returned a non-JSON response: ${text.slice(0, 500)}`);
    }
    return body as Record<string, unknown>;
  }

  return {
    async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
      const { address, recipientName, weightGrams, itemQuantity } = input;
      const body = await call("ACS_Create_Voucher", {
        Pickup_Date: new Date().toISOString().slice(0, 10),
        Recipient_Name: recipientName,
        Recipient_Address: [address.address1, address.address2].filter(Boolean).join(", "),
        Recipient_Zipcode: address.postalCode,
        Recipient_Region: address.region || address.city,
        Recipient_Phone: address.phone ?? "",
        Recipient_Cell_Phone: address.phone ?? "",
        Recipient_Country: address.countryCode,
        Charge_Type: 2,
        Item_Quantity: itemQuantity,
        Weight: Math.max(0.1, weightGrams / 1000),
      });

      // ACS wraps results in an output array under a key that varies by account/API
      // version in the sources available at build time — check the documented
      // candidates before giving up, and surface the raw body on failure so a real
      // integrator can see the actual shape from their own account.
      const output = (body.ACSOutputResponce ?? body.ACSOutputResponse ?? body.Data ?? body.data) as
        | Array<Record<string, unknown>>
        | undefined;
      const first = Array.isArray(output) ? output[0] : undefined;
      const trackingNumber = (first?.Voucher_No ?? first?.voucher_No ?? body.Voucher_No) as string | number | undefined;

      if (!trackingNumber) {
        throw new CourierError(`ACS_Create_Voucher succeeded but no voucher number was found in the response: ${JSON.stringify(body).slice(0, 500)}`);
      }

      return {
        trackingNumber: String(trackingNumber),
        carrier: ACS_CARRIER_NAME,
        trackingUrl: buildTrackingUrl(ACS_CARRIER_NAME) ?? "https://www.acscourier.net/en/track-and-trace",
      };
    },
  };
}
