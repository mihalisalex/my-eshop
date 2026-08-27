"use client";
import { useTranslations } from "next-intl";

import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/components/providers/AuthProvider";

interface BackInStockDialogProps {
  productId: string;
  sizeName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BackInStockDialog({ productId, sizeName, open, onOpenChange }: BackInStockDialogProps) {
  const t = useTranslations("BackInStock");
  const { customer } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");

  const effectiveEmail = customer?.email ?? email;

  function handleOpenChange(next: boolean) {
    if (next) setStatus("idle");
    onOpenChange(next);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!sizeName || !effectiveEmail) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/back-in-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, sizeName, email: effectiveEmail }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm rounded-none border-none p-8">
        <DialogTitle className="font-heading text-xl">{t("notifyMe")}</DialogTitle>
        {status === "done" ? (
          <p className="mt-4 text-sm text-luxe-gray-dark">
            We&apos;ll email you the moment size {sizeName} is back in stock.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <p className="text-sm text-luxe-gray-dark">
              Size {sizeName} is currently out of stock. Leave your email and we&apos;ll let you know when it&apos;s back.
            </p>
            {customer ? (
              <p className="text-sm text-luxe-black">{customer.email}</p>
            ) : (
              <div>
                <label htmlFor="back-in-stock-email" className="mb-1.5 block text-eyebrow">
                  {t("emailAddress")}
                </label>
                <input
                  id="back-in-stock-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black"
                />
              </div>
            )}
            {status === "error" ? <p className="text-sm text-destructive">{t("somethingWrong")}</p> : null}
            <button
              type="submit"
              disabled={status === "submitting"}
              className="flex h-12 w-full items-center justify-center bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "submitting" ? "Submitting…" : t("notifyMe")}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
