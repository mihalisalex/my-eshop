# Payments — developer guide

How payments work in this project, and how to add a provider without touching
checkout, orders, the database or the admin dashboard.

---

## 1. The shape of it

```
Checkout UI  ──►  GET /api/payment-methods        ──►  services/payments.ts
   │                                                        │
   │                                                        ├─► lib/payments/config.ts      (credentials, settings)
   │                                                        ├─► lib/payments/availability.ts (may we offer this?)
   │                                                        └─► lib/payments/fees.ts        (what does it cost?)
   │
   └──►  POST /api/checkout/:id/complete  ──►  services/checkout.ts
                                                    │
                                                    └─► services/payments.ts  initiatePayment()
                                                              │
                                                              └─► lib/payments/registry.ts
                                                                        │
                                          ┌───────────────┬─────────────┼─────────────┬──────────────┐
                                   CashOnDelivery   BankTransfer     Stripe       ApplePay     Iris / Piraeus
```

The checkout never imports a provider. It knows four things and nothing else:

| Concept | Where it lives |
|---|---|
| `PaymentMethod` (what a shopper picks) | `AvailablePaymentMethod` in `services/payments.ts` |
| `PaymentIntent` (starting a payment) | `initiatePayment()` → `CustomerAction` |
| `PaymentStatus` | `lib/payments/types.ts` + `lib/payments/status.ts` |
| `PaymentResult` | `lib/payments/types.ts` |

The **one** branch the storefront takes on payment behaviour is
`customerAction.type === "redirect"`. That is about the *action*, not the vendor —
Stripe, Piraeus, IRIS and a provider nobody has written yet all travel the same path.

### File map

| Path | What it is |
|---|---|
| `lib/payments/types.ts` | The whole vocabulary. Provider contract, statuses, config field schema. |
| `lib/payments/status.ts` | The state machine. Every status change funnels through `assertTransition`. |
| `lib/payments/registry.ts` | Provider registration. Adding a provider = one line here. |
| `lib/payments/config.ts` | Credential + settings storage, env-var precedence, masked admin projection. |
| `lib/payments/crypto.ts` | AES-256-GCM secret storage, constant-time signature comparison. |
| `lib/payments/availability.ts` | Pure: may this method be offered for this order? |
| `lib/payments/fees.ts` | Pure: what does this method add to the total? |
| `lib/payments/idempotency.ts` | Pure: the key that stops double-charging. |
| `lib/payments/providers/*` | One file per provider. |
| `services/payments.ts` | The only seam the rest of the app uses. |
| `app/api/payments/webhooks/[provider]/route.ts` | One endpoint, every provider, zero provider-specific code. |
| `app/admin/(dashboard)/settings/payments/*` | Control panel, rendered from the registry. |
| `app/admin/(dashboard)/payments/*` | Transaction list, detail, timeline, refunds. |

---

## 2. Data model

Payments are their **own** tables, not columns on `Order`. An order's lifecycle and
its money's lifecycle are separate facts — a Cash-on-Delivery order ships while its
payment is still pending, and a delivered order can later be refunded without the
shipment un-happening.

| Table | Purpose |
|---|---|
| `payments` | One attempt to collect the money for an order. |
| `payment_transactions` | Append-only audit trail. Never updated, never deleted. |
| `payment_webhook_events` | Raw inbound webhooks, unique on `(provider, eventId)`. |
| `payment_provider_configs` | Credentials + environment, secrets encrypted. |
| `payment_method_settings` | Admin-editable fee, limits, countries, sort order. |

**Capabilities are not in the database.** `supportsRefunds`, `requiresWebhook`,
`requiresRedirect` and friends live in code beside the provider that implements
them, where an admin cannot toggle them into being true.

---

## 3. Status transitions

```
                    ┌──────────────────────────┐
                    ▼                          │
pending ──► awaiting_customer_action ──► processing ──► paid ──► partially_refunded ──► refunded
   │                    │                     │           │
   ├──► awaiting_bank_transfer ───────────────┼───────────┘
   │                    │                     │
   └────────────────────┴─────────────────────┴──► failed ──► pending (retry)
                                                    │
                        cancelled ◄─────────────────┘
                        expired
```

Rules the machine enforces (`lib/payments/status.ts`, tested in `status.test.ts`):

- **Nothing un-settles money.** `paid` can only become a refund state.
- **`cancelled` / `refunded` / `expired` are terminal.** A stale QR code or redirect
  can never revive an abandoned payment.
- **There is no `awaiting_bank_transfer → processing` edge.** A transfer is unpaid
  until a human (or a future reconciliation API) confirms it. Nothing automatic
  settles it.
- **Re-asserting the current status is a no-op, not an error.** Duplicate webhooks
  and status polls are ordinary traffic.

Order status and payment status are kept separate and always shown separately in the
admin.

---

## 4. Adding a provider

Worked example: **Viva Wallet**. Nothing outside these two files changes.

### Step 1 — write the provider

`lib/payments/providers/viva-wallet.ts`

```ts
import "server-only";
import type { PaymentProvider, PaymentMethodDefinition, PaymentConfigField } from "@/lib/payments/types";
import { PaymentError } from "@/lib/payments/types";

const CONFIG_FIELDS: readonly PaymentConfigField[] = [
  { key: "merchantId",  label: "Merchant ID",  type: "text",   secret: false, required: true },
  { key: "apiKey",      label: "API key",      type: "secret", secret: true,  required: true },
  { key: "webhookSecret", label: "Webhook secret", type: "secret", secret: true, required: false },
];

const VIVA_CARD: PaymentMethodDefinition = {
  id: "viva-card",
  providerId: "viva-wallet",
  name: "Cards (Viva Wallet)",
  defaultDisplayName: "Credit / Debit Card",
  defaultDescription: "Card payments processed by Viva Wallet.",
  type: "card",
  defaultEnabled: false,          // needs credentials, so never on by default
  requiresRedirect: true,
  requiresManualConfirmation: false,
  requiresWebhook: true,
  supportsRefunds: true,
  supportsPartialRefunds: true,
  supportsCapture: true,
  supportsRecurring: false,
  supportedCurrencies: ["EUR"],
  icon: "card",
};

export const vivaWalletProvider: PaymentProvider = {
  id: "viva-wallet",
  name: "Viva Wallet",
  description: "Card acquiring through Viva Wallet.",
  methods: [VIVA_CARD],
  configFields: CONFIG_FIELDS,
  supportsEnvironments: true,
  supportsConnectionTest: true,
  webhookSupported: true,

  isConfigured: (config) => Boolean(config.values.merchantId && config.secrets.apiKey),

  async validateConfiguration(config) {
    if (!this.isConfigured(config)) {
      return { status: "not_configured", message: "Merchant ID and API key are required.", checkedLive: false };
    }
    // Make a REAL authenticated request here. Never return `connected` without one.
    return { status: "connected", message: "Connected.", checkedLive: true };
  },

  async initializePayment(ctx) {
    // ctx.payment.amount is server-computed. Never accept an amount from a caller.
    return {
      status: "awaiting_customer_action",
      externalPaymentId: "…provider order id…",
      customerAction: { type: "redirect", redirectUrl: "…provider checkout url…" },
    };
  },

  async confirmPayment(ctx)  { /* server-side lookup, return the provider's truth */ },
  async cancelPayment(ctx)   { /* … */ },
  async refundPayment(ctx)   { /* ctx.amount is validated by the service first */ },
  async getPaymentStatus(ctx){ /* … */ },

  async parseWebhook(request, config) {
    // Verify against request.rawBody EXACTLY as received. Throw
    // PaymentWebhookVerificationError on a bad signature.
    return { eventId: "…", eventType: "…", paymentId: null, externalPaymentId: "…", status: "paid" };
  },
};
```

### Step 2 — register it

`lib/payments/registry.ts`

```ts
import { vivaWalletProvider } from "@/lib/payments/providers/viva-wallet";
paymentProviderRegistry.register(vivaWalletProvider);
```

### That's the whole change

You now automatically have:

- a settings page at `/admin/settings/payments/viva-wallet`, rendered from
  `configFields` — no React written;
- encrypted credential storage, masking, and env-var override
  (`VIVA_WALLET_API_KEY`, `VIVA_WALLET_ENABLED`, `VIVA_WALLET_ENVIRONMENT`);
- a working **Test Connection** button;
- a webhook endpoint at `/api/payments/webhooks/viva-wallet` with signature
  verification, deduplication, raw-payload storage and retry-safe handling;
- the method on the checkout the moment it is enabled and configured;
- fee, order-value limits, country and delivery-method restrictions;
- rows in `/admin/payments`, a timeline, and refund actions.

**Zero changes** to: the checkout UI, `services/checkout.ts`, the `Order` model, the
database schema, or the webhook route.

---

## 5. Adding a payment method to an existing provider

Add another entry to that provider's `methods` array. Method ids must be globally
unique — the registry throws at boot if two providers claim the same one. A row
appears in the admin method table with default settings; no migration is needed,
because `getAllMethodSettings()` fills in defaults for methods that have no row yet.

## 6. Adding a configuration field

Add a `PaymentConfigField` to the provider's `configFields`. The admin form renders
it. Set `secret: true` for anything that must be encrypted, masked and never
returned to the browser — that is enforced centrally in `lib/payments/config.ts`, not
by each provider remembering to do it.

Scope a field to one environment with `environment: "sandbox" | "production"`, as
Stripe does for its test/live key pairs.

## 7. Adding a webhook

Implement `parseWebhook` and set `webhookSupported: true`. The shared route already
exists. Your parser receives the **raw body string** — verify the signature against
those exact bytes, and never `JSON.parse` then re-stringify before verifying.

Return `{ ignored: true }` for events you don't act on. Do **not** throw: the
pipeline acknowledges ignored events with a 200 so the provider doesn't retry
forever and eventually disable the endpoint. Throw
`PaymentWebhookVerificationError` **only** for a genuine signature failure — that is
the one case that returns a 400.

## 8. Testing a provider

`Test Connection` calls `validateConfiguration`. The `ConfigurationTestResult` type
forces the honest answer:

```ts
{ status: "connected" | "auth_failed" | "not_configured" | "unavailable" | "not_implemented",
  message: string,
  checkedLive: boolean }   // ← false means NO request was made
```

The admin renders `checkedLive` verbatim ("Verified with a live request" vs
"reflects the stored configuration only"), so a green state that made no network
call can never be mistaken for a verified integration.

## 9. Refunds

`services/payments.ts`'s `refundPayment()` validates before calling the provider:
the method must declare `supportsRefunds`; a partial refund additionally requires
`supportsPartialRefunds`; and the amount is checked against
`amount − refundedAmount`. The running total lives on the payment row, so a second
partial refund can't exceed what's left.

For manual methods (COD, bank transfer) the provider records the refund rather than
calling an API — the admin performs the actual repayment. Recording it anyway is the
point: otherwise refunded COD orders exist only in someone's memory.

## 10. Idempotency

`derivePaymentIdempotencyKey(orderId, methodId, attempt)` is deterministic and
unique-constrained in the database. A double-click, a refresh, a dropped connection
or a return from a provider all derive the same key and recover the existing payment
— including its redirect URL, so a shopper resumes rather than restarts. Switching
method after a decline derives a different key, which is correct.

Webhooks are deduplicated separately, on a `(provider, eventId)` database unique
constraint — not an in-memory set, because serverless instances don't share memory.
Providers that don't issue an event id get a SHA-256 of the payload, which achieves
the same at-most-once effect for identical bodies.

Outbound writes to providers that support it (Stripe) carry an `Idempotency-Key`
header derived from the same value.

## 11. Security

- **Amounts are always computed server-side**, from the stored cart and checkout.
  No code path lets a browser-supplied number reach a provider.
- **Fees are computed server-side.** The quote shown at checkout and the amount
  charged come from the same function (`computePaymentFee`).
- **A method's availability is validated twice** — once to build the list, once at
  order time, both through `evaluateMethodAvailability`.
- **No card data ever touches this application.** There is no card form and no
  `cardSchema`; that was removed deliberately when this landed. Card entry happens
  on the processor's own page. No PAN, no CVV, no card storage.
- **A browser redirect is never proof of payment.** The confirmation page re-verifies
  server-side against the provider before showing a paid state.
- **Nothing client-side can set a payment status.** Every transition goes through
  `assertTransition` inside `services/payments.ts`, which has no HTTP surface a
  shopper can reach.
- **Secrets are AES-256-GCM encrypted at rest**, keyed from `PAYMENTS_CONFIG_SECRET`.
  A missing key is a hard error, never a silent fallback to plaintext.
- **Webhook signatures are compared in constant time** (`safeCompare`) with a
  timestamp tolerance, so a captured signature can't be replayed forever.
- **Admin actions are capability-gated**: `payments:view`, `payments:manage`,
  `payments:refund`, `payments:configure`. An editor can see whether an order is
  paid; they cannot confirm, refund, or read credentials.
- **Payment endpoints are rate-limited** through the existing `lib/rate-limit.ts`.
- **Secrets never reach logs.** `PaymentError` carries a separate `publicMessage`;
  the developer-facing text is logged server-side and never returned to a shopper.

## 12. What is deliberately not connected

`IRIS` and `Piraeus Bank` are **integration boundaries**, built with
`createPendingIntegrationProvider`. Everything structural is real — registration,
configuration UI, encrypted credential storage, a routable webhook endpoint, a place
in the status machine and the admin — but the three operations that would require
guessing an endpoint, a request body or an authentication scheme refuse loudly:

- `validateConfiguration` returns `not_implemented`, **never** `connected`. Filling
  in every credential does not turn the badge green.
- `isConfigured` returns `false` unconditionally, which keeps the method out of
  `getAvailablePaymentMethods` and therefore off the checkout entirely.
- `initializePayment` / `refundPayment` throw `PROVIDER_NOT_IMPLEMENTED`.

To complete one: replace the `createPendingIntegrationProvider(...)` call in that
file with a full `PaymentProvider` implementation, using the official specification.
Nothing else changes.

**Apple Pay** is a capability, not an acquirer. It owns the Apple-specific
configuration and the availability rules, and delegates every money operation to the
processor named in `processingProviderIdFor` (Stripe today). The checkout sees only
"Apple Pay". Its availability additionally requires the processor to be enabled and
configured, and — checked in the browser on top of everything the server decided — a
device that actually supports it.

**Stripe** uses hosted Checkout Sessions rather than Elements, so no card data
reaches this application and Apple Pay / Google Pay appear on Stripe's own verified
domain automatically. Moving to an on-site Elements integration later replaces
`lib/payments/providers/stripe.ts` only.

## 13. Local development

1. Set `PAYMENTS_CONFIG_SECRET` (see `.env.example`).
2. Cash on Delivery and Bank Transfer are enabled by default and need nothing else —
   a fresh install has a working checkout immediately.
3. For Stripe, use test keys and `stripe listen --forward-to
   localhost:3000/api/payments/webhooks/stripe` to receive webhooks locally.
4. `npm test` covers the state machine, availability, fees, idempotency, secret
   storage, the registry's structural guarantees, both internal providers, both
   pending boundaries, and Stripe's status mapping, webhook signature verification
   and event normalisation — all without a database or a network.
