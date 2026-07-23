"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { newsletterSchema, type NewsletterFormValues } from "@/lib/validations/newsletter";

interface NewsletterFormProps {
  ctaLabel?: string;
  compact?: boolean;
  /** Set when the form sits on a dark section background (e.g. the homepage Newsletter section). */
  onDark?: boolean;
  className?: string;
  /** Swappable for a real subscribe endpoint (Klaviyo, Shopify, custom API) later. */
  onSubscribe?: (values: NewsletterFormValues) => Promise<void>;
}

export function NewsletterForm({
  ctaLabel = "Subscribe",
  compact = false,
  onDark = false,
  className,
  onSubscribe,
}: NewsletterFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterFormValues>({ resolver: zodResolver(newsletterSchema) });

  const onSubmit = async (values: NewsletterFormValues) => {
    if (onSubscribe) {
      await onSubscribe(values);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    setSubmitted(true);
    reset();
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
      {errors.email ? (
        <p className="mt-2 text-xs text-destructive">{errors.email.message}</p>
      ) : null}
    </form>
  );
}
