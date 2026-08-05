"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { newsletterSchema, type NewsletterFormValues } from "@/lib/validation/newsletter";

interface NewsletterFormProps {
  ctaLabel?: string;
  compact?: boolean;
  /** Set when the form sits on a dark section background (e.g. the homepage Newsletter section). */
  onDark?: boolean;
  className?: string;
  /** Which surface this instance sits on — recorded with the signup. */
  source?: string;
  /** Escape hatch for pointing a given instance at a different destination (e.g. an ESP). */
  onSubscribe?: (values: NewsletterFormValues) => Promise<void>;
}

export function NewsletterForm({
  ctaLabel = "Subscribe",
  compact = false,
  onDark = false,
  className,
  source,
  onSubscribe,
}: NewsletterFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterFormValues>({ resolver: zodResolver(newsletterSchema) });

  // Previously this awaited a 500ms timer and then reported success unconditionally,
  // discarding the address — so the confirmation below was a lie on every submission.
  const onSubmit = async (values: NewsletterFormValues) => {
    setSubmitError(null);
    try {
      if (onSubscribe) {
        await onSubscribe(values);
      } else {
        const response = await fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, source }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error?.message ?? "Something went wrong. Please try again.");
        }
      }
      setSubmitted(true);
      reset();
    } catch (error) {
      // Staying on the form with the address intact is the point — showing the success
      // state here would repeat the original bug in a subtler form.
      setSubmitError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  };

  if (submitted) {
    return (
      <p className={cn("flex items-center gap-2 text-sm", className)}>
        <Check className="size-4" strokeWidth={1.5} />
        Thank you — you&apos;re on the list.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className={className}>
      <div
        className={cn(
          "flex items-center border-b",
          onDark ? "border-luxe-white/30" : compact ? "border-luxe-gray-dark/40" : "border-luxe-black/30"
        )}
      >
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          placeholder="Your email address"
          className={cn(
            "w-full bg-transparent py-3 text-sm outline-none placeholder:text-current placeholder:opacity-50",
            compact ? "" : "text-base"
          )}
          {...register("email")}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          aria-label={ctaLabel}
          className="flex shrink-0 items-center gap-1 py-3 pl-3 text-xs font-medium tracking-[0.1em] uppercase disabled:opacity-50"
        >
          {ctaLabel}
          <ArrowRight className="size-4" strokeWidth={1.5} />
        </button>
      </div>
      {errors.email || submitError ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {errors.email?.message ?? submitError}
        </p>
      ) : null}
    </form>
  );
}
