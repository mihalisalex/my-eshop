"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { cn } from "@/lib/utils";
import { EASE } from "@/constants/animation";

export function ToastViewport() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-200 flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.25, ease: EASE }}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 border p-4 shadow-[0_16px_32px_-16px_rgba(0,0,0,0.25)]",
              t.tone === "error" ? "border-destructive bg-luxe-white" : "border-luxe-black bg-luxe-white"
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description ? <p className="mt-0.5 text-xs text-luxe-gray-dark">{t.description}</p> : null}
              {t.action ? (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="mt-2 text-xs font-medium tracking-[0.05em] uppercase underline underline-offset-4"
                >
                  {t.action.label}
                </button>
              ) : null}
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="shrink-0">
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
