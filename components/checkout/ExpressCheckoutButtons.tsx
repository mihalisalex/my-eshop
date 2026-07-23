"use client";

import { useToast } from "@/components/providers/ToastProvider";

const EXPRESS_OPTIONS = [
  { id: "apple-pay", label: "Apple Pay" },
  { id: "google-pay", label: "Google Pay" },
  { id: "paypal", label: "PayPal" },
] as const;

export function ExpressCheckoutButtons() {
  const { toast } = useToast();

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {EXPRESS_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() =>
              toast({
                title: "Not connected in this demo",
                description: `${option.label} would open here in a live store.`,
              })
            }
            className="flex h-12 items-center justify-center border border-luxe-black bg-luxe-black px-3 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase transition-opacity hover:opacity-85"
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-eyebrow">Or pay with card</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
