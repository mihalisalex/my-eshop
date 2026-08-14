"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { contactSchema, type ContactFormValues } from "@/lib/validation/contact";

const inputClass =
  "h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";

const TOPICS = ["Order support", "Returns & exchanges", "Product question", "Press & partnerships", "Something else"];

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({ resolver: zodResolver(contactSchema) });

  const onSubmit = async (values: ContactFormValues) => {
    setSubmitError(null);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setSubmitError(body?.error?.message ?? "Couldn't send your message. Please try again.");
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex items-start gap-3 border border-border bg-luxe-gray-light p-6">
        <Check className="mt-0.5 size-5 shrink-0" strokeWidth={1.5} />
        <div>
          <p className="font-medium">Message sent</p>
          <p className="mt-1 text-sm text-luxe-gray-dark">Thanks for reaching out — we&apos;ll get back to you within 1 business day.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {submitError ? <p className="border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{submitError}</p> : null}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="text-xs font-medium tracking-[0.05em] uppercase">
            Name
          </label>
          <input
            id="contact-name"
            className={cn(inputClass, "mt-2")}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            {...register("name")}
          />
          {errors.name ? (
            <p id="contact-name-error" className="mt-1 text-xs text-destructive">
              {errors.name.message}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="contact-email" className="text-xs font-medium tracking-[0.05em] uppercase">
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            className={cn(inputClass, "mt-2")}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            {...register("email")}
          />
          {errors.email ? (
            <p id="contact-email-error" className="mt-1 text-xs text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="contact-subject" className="text-xs font-medium tracking-[0.05em] uppercase">
          Topic
        </label>
        <select
          id="contact-subject"
          defaultValue=""
          className={cn(inputClass, "mt-2 appearance-none")}
          aria-invalid={Boolean(errors.subject)}
          aria-describedby={errors.subject ? "contact-subject-error" : undefined}
          {...register("subject")}
        >
          <option value="" disabled>
            Select a topic
          </option>
          {TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </select>
        {errors.subject ? (
          <p id="contact-subject-error" className="mt-1 text-xs text-destructive">
            {errors.subject.message}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="contact-message" className="text-xs font-medium tracking-[0.05em] uppercase">
          Message
        </label>
        <textarea
          id="contact-message"
          rows={5}
          className={cn(inputClass, "mt-2 h-auto py-3")}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          {...register("message")}
        />
        {errors.message ? (
          <p id="contact-message-error" className="mt-1 text-xs text-destructive">
            {errors.message.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex h-12 w-full items-center justify-center bg-luxe-black text-xs font-medium tracking-[0.1em] text-luxe-white uppercase transition-opacity hover:opacity-85 disabled:opacity-50 sm:w-auto sm:px-10"
      >
        {isSubmitting ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
