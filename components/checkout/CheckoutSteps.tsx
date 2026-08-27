"use client";
import { useTranslations } from "next-intl";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCheckout, type CheckoutStep } from "@/components/providers/CheckoutProvider";

const STEPS: { id: CheckoutStep; labelKey: string }[] = [
  { id: "contact", labelKey: "stepContact" },
  { id: "shipping", labelKey: "stepShipping" },
  { id: "delivery", labelKey: "stepDelivery" },
  { id: "payment", labelKey: "stepPayment" },
  { id: "review", labelKey: "stepReview" },
];

export function CheckoutSteps() {
  const t = useTranslations("Checkout");
  const { step, furthestStep, goToStep } = useCheckout();
  const stepIndex = (id: CheckoutStep) => STEPS.findIndex((s) => s.id === id);

  return (
    <nav aria-label={t("progress")} className="mb-8 flex items-center">
      {STEPS.map((s, index) => {
        const isCurrent = s.id === step;
        const isComplete = stepIndex(s.id) < stepIndex(step) || stepIndex(furthestStep) > stepIndex(s.id);
        const isReachable = stepIndex(s.id) <= stepIndex(furthestStep);

        return (
          <div key={s.id} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              disabled={!isReachable}
              onClick={() => goToStep(s.id)}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 text-xs font-medium tracking-[0.05em] uppercase transition-opacity",
                !isReachable && "cursor-not-allowed opacity-40",
                isReachable && !isCurrent && "opacity-60 hover:opacity-100"
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-[10px]",
                  isCurrent ? "border-luxe-black bg-luxe-black text-luxe-white" : "border-border"
                )}
              >
                {isComplete && !isCurrent ? <Check className="size-3" strokeWidth={2} /> : index + 1}
              </span>
              <span className="hidden sm:inline">{t(s.labelKey)}</span>
            </button>
            {index < STEPS.length - 1 ? <div className="mx-3 h-px flex-1 bg-border" /> : null}
          </div>
        );
      })}
    </nav>
  );
}
