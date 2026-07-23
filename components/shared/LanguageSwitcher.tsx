"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { Languages } from "lucide-react";
import { setLocaleAction } from "@/app/actions/locale";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

const LOCALE_LABEL: Record<Locale, string> = { en: "EN", el: "EL" };

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1.5 text-xs tracking-[0.05em] text-luxe-gray-dark uppercase">
      <Languages className="size-3.5" strokeWidth={1.5} />
      {SUPPORTED_LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => setLocaleAction(code))}
          className={cn(
            "px-1 transition-colors hover:text-luxe-black disabled:opacity-50",
            locale === code ? "text-luxe-black underline underline-offset-4" : ""
          )}
        >
          {LOCALE_LABEL[code]}
        </button>
      ))}
    </div>
  );
}
