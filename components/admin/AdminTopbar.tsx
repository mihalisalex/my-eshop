"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LogOut } from "lucide-react";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { ADMIN_NAV } from "@/constants/admin-nav";
import { logoutAction } from "@/app/admin/actions";
import type { AdminSession } from "@/lib/auth";

interface AdminTopbarProps {
  session: AdminSession;
}

const ALL_ITEMS = ADMIN_NAV.flatMap((group) => group.items);

export function AdminTopbar({ session }: AdminTopbarProps) {
  const pathname = usePathname();
  const current = [...ALL_ITEMS].sort((a, b) => b.href.length - a.href.length).find((item) =>
    pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-luxe-white px-4 md:px-8">
      <div className="flex items-center gap-3">
        <AdminMobileNav />
        <h1 className="text-base font-medium">{current?.label ?? "Dashboard"}</h1>
      </div>
      <div className="flex items-center gap-4">
        <Link
          href="/"
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 text-xs font-medium tracking-[0.05em] text-luxe-gray-dark uppercase transition-colors hover:text-luxe-black sm:flex"
        >
          View Store
          <ExternalLink className="size-3.5" strokeWidth={1.5} />
        </Link>
        <div className="hidden text-right sm:block">
          <p className="text-sm leading-tight">{session.name}</p>
          <p className="text-xs leading-tight text-luxe-gray-dark">{session.role}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            aria-label="Sign out"
            className="flex size-9 items-center justify-center border border-border transition-colors hover:border-luxe-black"
          >
            <LogOut className="size-4" strokeWidth={1.5} />
          </button>
        </form>
      </div>
    </header>
  );
}
