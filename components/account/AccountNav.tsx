"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";

const NAV_ITEMS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/account/returns", label: "Returns" },
  { href: "/account/referrals", label: "Refer a Friend" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/preferences", label: "Preferences" },
  { href: "/account/security", label: "Security" },
];

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <nav aria-label="Account" className="space-y-1">
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
            {item.label}
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
        Sign Out
      </button>
    </nav>
  );
}
