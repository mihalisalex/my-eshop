"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface ReviewFormProps {
  productId: string;
}

const INPUT_CLASS =
  "h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black";

/**
 * Leaving a review.
 *
 * Opens only when asked for. A form sitting permanently open under a product pushes the
 * things a shopper came for — related products, recently viewed — an entire screen down, to
 * serve the small fraction of visitors who are here to write rather than to buy.
 */
export function ReviewForm({ productId }: ReviewFormProps) {
  const t = useTranslations("Reviews");
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ published: boolean } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productId,
        rating,
        title: String(form.get("title") ?? ""),
        body: String(form.get("body") ?? ""),
        authorName: String(form.get("authorName") ?? ""),
        authorEmail: String(form.get("authorEmail") ?? ""),
      }),
    }).catch(() => null);

    setSubmitting(false);

    // A network failure and a rejected submission are different things, and the shopper who
    // just typed four sentences deserves to know which one happened.
    if (!response) {
      setError(t("networkError"));
      return;
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? t("genericError"));
      return;
    }

    setDone(await response.json());
  }

  if (done) {
    return (
      <div className="mt-6 border border-border bg-luxe-gray-light p-5">
        <p className="text-sm">{done.published ? t("thanksPublished") : t("thanksPending")}</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 h-11 border border-luxe-black px-6 text-sm font-medium tracking-[0.05em] uppercase transition-opacity hover:opacity-70"
      >
        {t("writeReview")}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 max-w-xl space-y-4 border border-border p-5">
      <fieldset>
        <legend className="text-eyebrow mb-2">{t("yourRating")}</legend>
        {/* Radios rather than buttons, so the rating is reachable by keyboard and announced
            as one group of five choices rather than five unrelated controls. */}
        <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="cursor-pointer" onMouseEnter={() => setHovered(value)}>
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className="sr-only peer"
              />
              <Star
                className={cn(
                  "size-7 transition-colors peer-focus-visible:outline peer-focus-visible:outline-luxe-black",
                  value <= (hovered || rating) ? "fill-luxe-black text-luxe-black" : "text-border"
                )}
                strokeWidth={1.5}
              />
              <span className="sr-only">{t("starsOutOfFive", { count: value })}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="text-eyebrow mb-1.5 block" htmlFor="rf-title">{t("reviewTitle")}</label>
        <input id="rf-title" name="title" className={INPUT_CLASS} maxLength={120} required />
      </div>

      <div>
        <label className="text-eyebrow mb-1.5 block" htmlFor="rf-body">{t("reviewBody")}</label>
        <textarea
          id="rf-body"
          name="body"
          rows={4}
          className={INPUT_CLASS.replace("h-11", "h-auto py-2")}
          maxLength={4000}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-eyebrow mb-1.5 block" htmlFor="rf-name">{t("yourName")}</label>
          <input id="rf-name" name="authorName" className={INPUT_CLASS} maxLength={80} required />
        </div>
        <div>
          <label className="text-eyebrow mb-1.5 block" htmlFor="rf-email">{t("yourEmail")}</label>
          <input id="rf-email" name="authorEmail" type="email" className={INPUT_CLASS} maxLength={200} required />
          <p className="mt-1 text-xs text-luxe-gray-dark">{t("emailPrivate")}</p>
        </div>
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="h-11 bg-luxe-black px-6 text-sm font-medium tracking-[0.05em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? t("submitting") : t("submitReview")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-luxe-gray-dark underline underline-offset-4 hover:text-luxe-black"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
