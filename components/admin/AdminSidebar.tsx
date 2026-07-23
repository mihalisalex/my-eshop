"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV } from "@/constants/admin-nav";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-luxe-white md:flex md:flex-col">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/admin" className="font-heading text-lg tracking-[0.1em] uppercase">
          ALEXANDRIS
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {ADMIN_NAV.map((group) => (
          <div key={group.title} className="mb-6">
            <p className="px-3 text-[10px] font-medium tracking-[0.1em] text-luxe-gray-dark uppercase">
              {group.title}
            </p>
            <ul className="mt-2 space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-luxe-black text-luxe-white"
                          : "text-luxe-black/80 hover:bg-luxe-gray-light"
                      )}
                    >
                      <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
