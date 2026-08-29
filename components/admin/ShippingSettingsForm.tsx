"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { ShippingSettings } from "@/types";

interface ShippingSettingsFormProps {
  initialSettings: ShippingSettings;
  onSave: (settings: ShippingSettings) => Promise<void>;
}

const inputClass = "h-10 w-full border border-border px-3 text-sm outline-none focus:border-luxe-black";
const labelClass = "mb-1 block text-xs font-medium text-luxe-gray-dark uppercase";

export function ShippingSettingsForm({ initialSettings, onSave }: ShippingSettingsFormProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [saved, setSaved] = useState<"idle" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  const freeShippingOn = settings.freeShippingThreshold !== null;

  const patchRate = (id: string, patch: Partial<ShippingSettings["rates"][number]>) => {
    setSettings((prev) => ({
      ...prev,
      rates: prev.rates.map((rate) => (rate.id === id ? { ...rate, ...patch } : rate)),
    }));
    setSaved("idle");
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        await onSave(settings);
        setSaved("saved");
      } catch {
        setSaved("error");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="border border-border bg-luxe-white p-4">
        <h3 className="mb-1 text-sm font-medium">Free shipping</h3>
        <p className="mb-4 text-xs text-luxe-gray-dark">
          Applies to rates marked eligible below, on the order value after any discount and before
          shipping. Turning it off charges every rate its listed price at any basket size.
        </p>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={freeShippingOn}
            onChange={(event) => {
              setSettings((prev) => ({
                ...prev,
                // Remembers 150 as the value to come back to rather than 0, which would make
                // every order free the moment someone re-enabled it.
                freeShippingThreshold: event.target.checked ? (prev.freeShippingThreshold ?? 150) : null,
              }));
              setSaved("idle");
            }}
          />
          Offer free shipping over a threshold
        </label>

        {freeShippingOn ? (
          <div className="mt-3 max-w-48">
            <label className={labelClass} htmlFor="free-shipping-threshold">
              Threshold (EUR)
            </label>
            <input
              id="free-shipping-threshold"
              type="number"
              min={0}
              step="0.01"
              value={settings.freeShippingThreshold ?? 0}
              onChange={(event) => {
                setSettings((prev) => ({ ...prev, freeShippingThreshold: Number(event.target.value) }));
                setSaved("idle");
              }}
              className={inputClass}
            />
          </div>
        ) : null}
      </div>

      <div className="border border-border bg-luxe-white">
        <div className="border-b border-border p-4">
          <h3 className="text-sm font-medium">Delivery methods</h3>
          <p className="mt-1 text-xs text-luxe-gray-dark">
            Prices include VAT, like every other amount shown to a customer. A disabled method
            disappears from checkout but stays readable on orders that already used it.
          </p>
        </div>

        <div className="divide-y divide-border">
          {settings.rates.map((rate) => (
            <div key={rate.id} className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                {/* The id is persisted on every checkout and order row, so it is shown but never
                    editable — renaming one would orphan the rate on historical orders. */}
                <span className="font-mono text-xs text-luxe-gray-dark">{rate.id}</span>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={rate.enabled}
                    onChange={(event) => patchRate(rate.id, { enabled: event.target.checked })}
                  />
                  Available at checkout
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Name shown to customers</label>
                  <input
                    value={rate.label}
                    onChange={(event) => patchRate(rate.id, { label: event.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Price (EUR, incl. VAT)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={rate.amount}
                    onChange={(event) => patchRate(rate.id, { amount: Number(event.target.value) })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Description</label>
                  <input
                    value={rate.description}
                    onChange={(event) => patchRate(rate.id, { description: event.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Delivery estimate</label>
                  <input
                    value={rate.estimatedDelivery}
                    onChange={(event) => patchRate(rate.id, { estimatedDelivery: event.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rate.freeShippingEligible}
                  onChange={(event) => patchRate(rate.id, { freeShippingEligible: event.target.checked })}
                />
                Free over the threshold
                {!freeShippingOn ? (
                  <span className="text-xs text-luxe-gray-dark">(free shipping is currently off)</span>
                ) : null}
              </label>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border p-4">
          {saved === "saved" ? (
            <span className="flex items-center gap-1 text-xs text-green-700">
              <Check className="size-3.5" strokeWidth={1.5} />
              Saved
            </span>
          ) : saved === "error" ? (
            <span className="text-xs text-destructive">Couldn&apos;t save. Try again.</span>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="h-9 bg-luxe-black px-5 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
