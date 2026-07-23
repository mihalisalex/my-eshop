"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { NavItem } from "@/types";

interface MobileMenuProps {
  items: NavItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLight: boolean;
}

export function MobileMenu({ items, open, onOpenChange, triggerLight }: MobileMenuProps) {
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => onOpenChange(true)}
        className={triggerLight ? "text-luxe-white lg:hidden" : "text-luxe-black lg:hidden"}
      >
        <Menu className="size-5" strokeWidth={1.5} />
      </button>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-full border-none bg-luxe-white p-0 sm:max-w-sm"
      >
        <SheetTitle className="sr-only">Site navigation</SheetTitle>
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <span className="font-heading text-lg tracking-[0.15em] uppercase">Menu</span>
          <SheetClose aria-label="Close menu">
            <X className="size-5" strokeWidth={1.5} />
          </SheetClose>
        </div>

        <nav className="flex-1 overflow-y-auto px-6 py-4" aria-label="Mobile primary">
          <Accordion>
            {items.map((item) =>
              item.children?.length ? (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger className="py-4 text-[13px] font-medium tracking-[0.08em] uppercase no-underline hover:no-underline">
                    {item.label}
                  </AccordionTrigger>
                  <AccordionContent className="[&_a]:no-underline [&_a]:hover:text-luxe-black">
                    <ul className="space-y-3 pl-1">
                      {item.children.map((child) => (
                        <li key={child.id}>
                          <Link
                            href={child.href}
                            onClick={close}
                            className="block text-sm text-luxe-gray-dark no-underline"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ) : (
                <div key={item.id} className="border-b border-border py-4">
                  <Link
                    href={item.href}
                    onClick={close}
                    className="block text-[13px] font-medium tracking-[0.08em] uppercase no-underline"
                  >
                    {item.label}
                  </Link>
                </div>
              )
            )}
          </Accordion>
        </nav>

        <div className="border-t border-border px-6 py-6">
          <ul className="flex flex-col gap-3 text-sm text-luxe-gray-dark">
            <li>
              <Link href="/account" onClick={close} className="no-underline">
                Account
              </Link>
            </li>
            <li>
              <Link href="/wishlist" onClick={close} className="no-underline">
                Wishlist
              </Link>
            </li>
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
