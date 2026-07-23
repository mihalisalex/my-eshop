"use client";

import { useState, useTransition } from "react";
import type { OrderTrackingInput } from "@/services/orders";
import type { CreateShipmentActionState } from "@/app/admin/(dashboard)/orders/actions";

const inputClass =
  "h-10 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black";
const labelClass = "mb-1.5 block text-eyebrow";

interface OrderTrackingFormProps {
  defaultCarrier?: string;
  defaultTrackingNumber?: string;
  defaultTrackingUrl?: string;
  /** Computed server-side (COURIER_PROVIDER isn't a NEXT_PUBLIC_ var, so this can't be read client-side) — gates whether the "Create ACS Shipment" button renders at all. */
  courierProviderIsAcs: boolean;
  onSave: (input: OrderTrackingInput) => Promise<void>;
  onCreateAcsShipment?: () => Promise<CreateShipmentActionState>;
}

export function OrderTrackingForm({
  defaultCarrier,
  defaultTrackingNumber,
  defaultTrackingUrl,
  courierProviderIsAcs,
  onSave,
  onCreateAcsShipment,
}: OrderTrackingFormProps) {
  const [carrier, setCarrier] = useState(defaultCarrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(defaultTrackingNumber ?? "");
  const [trackingUrl, setTrackingUrl] = useState(defaultTrackingUrl ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "error" | "shipmentError">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCreatingShipment, startCreatingShipment] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      try {
        await onSave({ carrier: carrier || undefined, trackingNumber: trackingNumber || undefined, trackingUrl: trackingUrl || undefined });
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  };

  const handleCreateShipment = () => {
    if (!onCreateAcsShipment) return;
    startCreatingShipment(async () => {
      const result = await onCreateAcsShipment();
      if (result.error) {
        setErrorMessage(result.error);
        setStatus("shipmentError");
      } else {
        setStatus("saved");
        // The server action already persisted the result — reload to reflect it in the fields.
        window.location.reload();
      }
    });
  };

  return (
    <div className="border border-border bg-luxe-white p-6">
      <h3 className="mb-4 text-sm font-medium tracking-[0.05em] uppercase">Shipment & Tracking</h3>

      {courierProviderIsAcs && onCreateAcsShipment ? (
        <div className="mb-5 flex items-center justify-between border border-border bg-luxe-gray-light/40 p-3">
          <p className="text-xs text-luxe-gray-dark">Create a real ACS Courier shipment for this order.</p>
          <button
            type="button"
            onClick={handleCreateShipment}
            disabled={isCreatingShipment}
            className="h-8 shrink-0 border border-luxe-black px-3 text-xs font-medium tracking-[0.05em] uppercase disabled:opacity-50"
          >
            {isCreatingShipment ? "Creating..." : "Create ACS Shipment"}
          </button>
        </div>
      ) : null}

      {status === "shipmentError" ? <p className="mb-4 text-xs text-destructive">{errorMessage}</p> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="ot-carrier">Carrier</label>
          <input id="ot-carrier" className={inputClass} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="ACS Courier" />
        </div>
        <div>
          <label className={labelClass} htmlFor="ot-tracking">Tracking Number</label>
          <input id="ot-tracking" className={inputClass} value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ot-url">Tracking URL</label>
          <input id="ot-url" className={inputClass} value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        {status === "saved" ? <span className="text-xs text-green-700">Saved</span> : null}
        {status === "error" ? <span className="text-xs text-destructive">Couldn&apos;t save. Try again.</span> : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="h-9 bg-luxe-black px-5 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Tracking"}
        </button>
      </div>
    </div>
  );
}
