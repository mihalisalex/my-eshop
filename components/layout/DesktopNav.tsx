"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = (id: string) => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    setOpenId(id);
  };

  const scheduleClose = () => {
    closeTimeout.current = setTimeout(() => setOpenId(null), CLOSE_DELAY);
  };

  const activeItem = items.find((item) => item.id === openId && item.children?.length);

  return (
    <nav
      className="hidden items-center gap-8 lg:flex"
      onMouseLeave={scheduleClose}
      aria-label="Primary"
    >
      {items.map((item) => (
        <div key={item.id} onMouseEnter={() => open(item.id)} className="relative">
          <Link
            href={item.href}
            className={cn(
              "text-[13px] font-medium tracking-[0.08em] uppercase transition-opacity hover:opacity-60",
              transparentText ? "text-luxe-white" : "text-luxe-black"
            )}
          >
            {item.label}
          </Link>
        </div>
      ))}

      <AnimatePresence>
        {activeItem ? (
          <motion.div
            key={activeItem.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE }}
            onMouseEnter={() => open(activeItem.id)}
            className="absolute inset-x-0 top-full border-t border-border bg-luxe-white shadow-[0_16px_32px_-24px_rgba(0,0,0,0.25)]"
          >
            <div className="container-luxe grid grid-cols-4 gap-10 py-10">
              <ul className="col-span-1 space-y-4">
                {activeItem.children?.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={child.href}
                      className="text-sm text-luxe-black/80 transition-colors hover:text-luxe-black"
                    >
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="col-span-3 flex gap-4">
                {activeItem.featured?.map((feature) => (
                  <Link
                    key={feature.href}
                    href={feature.href}
                    className="group relative block h-56 w-72 overflow-hidden"
                  >
                    <Image
                      src={feature.image}
                      alt={feature.title}
                      fill
                      sizes="288px"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/55 p-4 text-sm font-medium text-white">
                      {feature.title}
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
