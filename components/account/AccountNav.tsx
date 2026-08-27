"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";

const NAV_ITEMS = [
  { href: "/account", key: "overview" },
  { href: "/account/orders", key: "orders" },
  { href: "/account/addresses", key: "addresses" },
  { href: "/wishlist", key: "wishlist" },
  { href: "/account/returns", key: "returns" },
  { href: "/account/referrals", key: "referrals" },
  { href: "/account/profile", key: "profile" },
  { href: "/account/preferences", key: "preferences" },
  { href: "/account/security", key: "security" },
] as const;

export function AccountNav() {
  const tA11y = useTranslations("A11y");
  const t = useTranslations("Account");
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <nav aria-label={tA11y("account")} className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "block px-3 py-2.5 text-sm transition-colors",
              isActive ? "bg-luxe-black text-luxe-white" : "text-luxe-gray-dark hover:bg-luxe-gray-light hover:text-luxe-black"
            )}
          >
            {t(item.key)}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.push("/");
        }}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-luxe-gray-dark hover:bg-luxe-gray-light hover:text-luxe-black"
      >
        <LogOut className="size-4" strokeWidth={1.5} />
        {t("signOut")}
      </button>
    </nav>
  );
}
