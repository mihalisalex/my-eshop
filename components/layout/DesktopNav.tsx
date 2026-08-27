"use client";
import { useTranslations } from "next-intl";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { NavItem } from "@/types";
import { cn } from "@/lib/utils";
import { EASE } from "@/constants/animation";

interface DesktopNavProps {
  items: NavItem[];
  /** true while the header itself is still in its transparent/light-text state */
  transparentText: boolean;
}

const CLOSE_DELAY = 120;

export function DesktopNav({ items, transparentText }: DesktopNavProps) {
  const tA11y = useTranslations("A11y");
  const tNav = useTranslations("Nav");
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The mobile menu renders the same `primary` array unfiltered, so an item marked
  // `mobileOnly` disappears from the header without disappearing from the phone.
  const visibleItems = items.filter((item) => !item.mobileOnly);

  const open = (id: string) => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    setOpenId(id);
  };

  const scheduleClose = () => {
    closeTimeout.current = setTimeout(() => setOpenId(null), CLOSE_DELAY);
  };

  const activeItem = visibleItems.find((item) => item.id === openId && item.children?.length);

  return (
    <nav
      className="hidden items-center gap-10 lg:flex"
      onMouseLeave={scheduleClose}
      aria-label={tA11y("primaryNav")}
    >
      {visibleItems.map((item) => (
        <div key={item.id} onMouseEnter={() => open(item.id)} className="group relative py-2">
          <Link
            href={item.href}
            className={cn(
              "relative text-[13px] font-medium tracking-[0.08em] uppercase transition-colors duration-300",
              transparentText ? "text-luxe-white" : "text-luxe-black",
              item.id === openId ? "opacity-100" : "opacity-90 hover:opacity-100"
            )}
          >
            {item.label}
            <span
              className={cn(
                "pointer-events-none absolute inset-x-0 -bottom-1 h-px origin-center scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100",
                transparentText ? "bg-luxe-white" : "bg-luxe-black",
                item.id === openId && "scale-x-100"
              )}
            />
          </Link>
        </div>
      ))}

      <AnimatePresence>
        {activeItem ? (
          <motion.div
            key={activeItem.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: EASE }}
            onMouseEnter={() => open(activeItem.id)}
            className="absolute inset-x-0 top-full border-t border-luxe-black bg-luxe-white shadow-[0_24px_48px_-28px_rgba(0,0,0,0.3)]"
          >
            <div className="container-luxe grid grid-cols-12 gap-x-10 py-14">
              <div className="col-span-3">
                <h2 className="font-heading text-3xl">{activeItem.label}</h2>
                <Link
                  href={activeItem.href}
                  className="mt-5 inline-flex items-center gap-1.5 text-xs tracking-[0.08em] text-luxe-gray-dark uppercase transition-colors hover:text-luxe-black"
                >
                  {tNav("viewAll")}
                  <ArrowRight className="size-3.5" strokeWidth={1.5} />
                </Link>
              </div>

              <div className="col-span-3 border-l border-border pl-10">
                <p className="text-eyebrow mb-5">{tNav("shopByCategory")}</p>
                <ul className="space-y-3.5">
                  {activeItem.children?.map((child) => (
                    <li key={child.id}>
                      <Link href={child.href} className="group/link relative inline-block text-sm text-luxe-black/80 transition-colors hover:text-luxe-black">
                        {child.label}
                        <span className="pointer-events-none absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-luxe-black transition-transform duration-300 ease-out group-hover/link:scale-x-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="col-span-6 flex justify-end gap-5">
                {activeItem.featured?.map((feature) => (
                  <Link
                    key={feature.href}
                    href={feature.href}
                    className="group/feature relative block h-64 w-72 shrink-0 overflow-hidden"
                  >
                    <Image
                      src={feature.image}
                      alt={feature.title}
                      fill
                      sizes="288px"
                      className="object-cover transition-transform duration-700 ease-out group-hover/feature:scale-105"
                    />
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <span className="absolute inset-x-0 bottom-0 p-5">
                      <span className="font-heading block text-lg text-white">{feature.title}</span>
                      <span className="mt-1.5 flex items-center gap-1 text-[11px] tracking-[0.1em] text-white/0 uppercase transition-colors duration-300 group-hover/feature:text-white/90">
                        {tNav("discover")}
                        <ArrowRight className="size-3 -translate-x-1 opacity-0 transition-all duration-300 group-hover/feature:translate-x-0 group-hover/feature:opacity-100" strokeWidth={1.5} />
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  );
}
