import { CommerceError } from "@/lib/commerce/types";

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

const KNOWN_COMMERCE_ERROR_CODES: ReadonlyArray<CommerceError["code"]> = [
  "OUT_OF_STOCK",
  "INVALID_DISCOUNT_CODE",
  "DISCOUNT_ALREADY_APPLIED",
  "INVALID_GIFT_CARD",
  "CART_NOT_FOUND",
  "LINE_ITEM_NOT_FOUND",
  "INVALID_CREDENTIALS",
  "EMAIL_IN_USE",
  "CHECKOUT_INCOMPLETE",
];

/**
 * Shared fetch helper for every remote/*.service.ts file. Reconstructs a
 * CommerceError from `{ error: { code, message } }` response bodies (see
 * lib/commerce/http-errors.ts on the server side) so UI can still branch on
 * `.code` exactly as it did against the mock adapter.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    const code = body?.error?.code;
    const message = body?.error?.message ?? `Request failed (${response.status})`;
    if (code && (KNOWN_COMMERCE_ERROR_CODES as string[]).includes(code)) {
      throw new CommerceError(code as CommerceError["code"], message);
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}
