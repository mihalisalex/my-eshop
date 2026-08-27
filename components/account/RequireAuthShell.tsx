"use client";
import { useTranslations } from "next-intl";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { AccountNav } from "@/components/account/AccountNav";

export function RequireAuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("Auth");
  const { customer, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !customer) router.replace("/account/login");
  }, [isLoading, customer, router]);

  if (isLoading || !customer) {
    return <div className="container-luxe py-24 text-center text-sm text-luxe-gray-dark">{t("loadingAccount")}</div>;
  }

  return (
    <div className="container-luxe grid grid-cols-1 gap-10 py-10 md:py-14 lg:grid-cols-[220px_1fr]">
      <aside>
        <AccountNav />
      </aside>
      <div>{children}</div>
    </div>
  );
}
