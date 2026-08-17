"use client";

import { useState, useTransition } from "react";
import { saveMethodSettingsAction } from "@/app/admin/(dashboard)/settings/payments/actions";
import { useToast } from "@/components/providers/ToastProvider";
import type { PaymentMethodDefinition, PaymentMethodSettings } from "@/lib/payments/types";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black";

/**
 * Merchandising settings for one method: fee, order-value limits, countries,
 * delivery restrictions, display copy.
 *
 * Deliberately separate from the provider's credential form, because these are
 * different kinds of setting with different blast radii. What is NOT here is just
 * as deliberate: `supportsRefunds`, `requiresWebhook` and friends are properties of
 * the integration, shown read-only below. An admin toggling "supports refunds" on a
 * provider that has no refund API would be configuring a lie.
 */
export function MethodSettingsForm({
  definition,
  settings,
  shippingRates,
}: {
  definition: PaymentMethodDefinition;
  settings: PaymentMethodSettings;
  shippingRates: { id: string; label: string }[];
}) {
  const [feeType, setFeeType] = useState(settings.feeType);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveMethodSettingsAction(formData);
      if (result.error) {
        toast({ title: "Couldn't save", description: result.error, tone: "error" });
        return;
      }
      toast({ title: result.success ?? "Saved" });
    });
  };

  return (
    <form action={onSubmit} className="border border-border bg-luxe-white p-5">
      <input type="hidden" name="methodId" value={definition.id} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium tracking-[0.05em] uppercase">{definition.name}</h3>
          <p className="mt-1 text-xs text-luxe-gray-dark">Method id: {definition.id}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={settings.enabled}
            className="size-4 border-border accent-luxe-black"
          />
          Enabled
        </label>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label htmlFor={`displayName-${definition.id}`} className="mb-1.5 block text-eyebrow">
            Display name
          </label>
          <input
            id={`displayName-${definition.id}`}
            name="displayName"
            defaultValue={settings.displayName ?? ""}
            placeholder={definition.defaultDisplayName}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`sortOrder-${definition.id}`} className="mb-1.5 block text-eyebrow">
            Sort order
          </label>
          <input
            id={`sortOrder-${definition.id}`}
            name="sortOrder"
            type="number"
            defaultValue={settings.sortOrder}
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor={`description-${definition.id}`} className="mb-1.5 block text-eyebrow">
          Description shown at checkout
        </label>
        <input
          id={`description-${definition.id}`}
          name="description"
          defaultValue={settings.description ?? ""}
          placeholder={definition.defaultDescription}
          className={inputClass}
        />
      </div>

      <fieldset className="mt-6 border-t border-border pt-5">
        <legend className="text-eyebrow">Fee</legend>
        <p className="mb-3 text-xs text-luxe-gray-dark">
          Added to the order total server-side. The amount a customer sees at checkout and the amount charged are
          computed by the same code, so they can&apos;t disagree.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`feeType-${definition.id}`} className="mb-1.5 block text-xs text-luxe-gray-dark">
              Fee type
            </label>
            <select
              id={`feeType-${definition.id}`}
              name="feeType"
              value={feeType}
              onChange={(event) => setFeeType(event.target.value as PaymentMethodSettings["feeType"])}
              className={cn(inputClass, "appearance-none")}
            >
              <option value="none">No fee</option>
              <option value="fixed">Fixed amount</option>
              <option value="percentage">Percentage of order total</option>
            </select>
          </div>
          <div>
            <label htmlFor={`feeValue-${definition.id}`} className="mb-1.5 block text-xs text-luxe-gray-dark">
              {feeType === "percentage" ? "Percent (e.g. 2 for 2%)" : "Amount in EUR"}
            </label>
            <input
              id={`feeValue-${definition.id}`}
              name="feeValue"
              type="number"
              step="0.01"
              min="0"
              defaultValue={settings.feeValue}
              disabled={feeType === "none"}
              className={cn(inputClass, feeType === "none" && "bg-luxe-gray-light text-luxe-gray-dark")}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="mt-6 border-t border-border pt-5">
        <legend className="text-eyebrow">Availability</legend>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`minimumAmount-${definition.id}`} className="mb-1.5 block text-xs text-luxe-gray-dark">
              Minimum order total
            </label>
            <input
              id={`minimumAmount-${definition.id}`}
              name="minimumAmount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={settings.minimumAmount ?? ""}
              placeholder="No minimum"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`maximumAmount-${definition.id}`} className="mb-1.5 block text-xs text-luxe-gray-dark">
              Maximum order total
            </label>
            <input
              id={`maximumAmount-${definition.id}`}
              name="maximumAmount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={settings.maximumAmount ?? ""}
              placeholder="No maximum"
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor={`countries-${definition.id}`} className="mb-1.5 block text-xs text-luxe-gray-dark">
            Countries (ISO codes, comma separated)
          </label>
          <input
            id={`countries-${definition.id}`}
            name="countries"
            defaultValue={settings.countries.join(", ")}
            placeholder="Leave blank for every country"
            className={inputClass}
          />
        </div>

        {shippingRates.length > 0 ? (
          <div className="mt-4">
            <p className="mb-1.5 text-xs text-luxe-gray-dark">
              Delivery methods this payment method is allowed with — leave all unticked for every delivery method
            </p>
            <div className="flex flex-wrap gap-4">
              {shippingRates.map((rate) => (
                <label key={rate.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="shippingRateIds"
                    value={rate.id}
                    defaultChecked={settings.shippingRateIds.includes(rate.id)}
                    className="size-4 border-border accent-luxe-black"
                  />
                  {rate.label}
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </fieldset>

      <div className="mt-6 border-t border-border pt-5">
        <p className="text-eyebrow mb-2">Capabilities</p>
        <p className="mb-3 text-xs text-luxe-gray-dark">
          Set by the integration itself, not configurable — these describe what the provider can actually do.
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-luxe-gray-dark">
          <Capability label="Refunds" on={definition.supportsRefunds} />
          <Capability label="Partial refunds" on={definition.supportsPartialRefunds} />
          <Capability label="Redirect" on={definition.requiresRedirect} />
          <Capability label="Manual confirmation" on={definition.requiresManualConfirmation} />
          <Capability label="Webhook" on={definition.requiresWebhook} />
          <Capability label="Capture" on={definition.supportsCapture} />
          <Capability label="Recurring" on={definition.supportsRecurring} />
        </ul>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 flex h-10 items-center justify-center bg-luxe-black px-5 text-xs font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save payment method"}
      </button>
    </form>
  );
}

function Capability({ label, on }: { label: string; on: boolean }) {
  return (
    <li className={cn(on ? "text-luxe-black" : "line-through opacity-60")}>
      {label}
    </li>
  );
}
