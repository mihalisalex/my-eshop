"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
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
  /** The footer's Support column, so a phone user can reach Contact/FAQ/Size Guide from the menu. */
  supportLinks?: { label: string; href: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLight: boolean;
}

export function MobileMenu({ items, supportLinks = [], open, onOpenChange, triggerLight }: MobileMenuProps) {
  const tA11y = useTranslations("A11y");
  const t = useTranslations("MobileMenu");
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <button
        type="button"
        aria-label={t("openMenu")}
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
        <SheetTitle className="sr-only">{t("siteNavigation")}</SheetTitle>
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <span className="font-heading text-lg tracking-[0.15em] uppercase">{t("menu")}</span>
          <SheetClose aria-label={t("closeMenu")}>
            <X className="size-5" strokeWidth={1.5} />
          </SheetClose>
        </div>

        <nav className="flex-1 overflow-y-auto px-6 py-4" aria-label={tA11y("mobileNav")}>
          <Accordion>
            {items.map((item) =>
              item.children?.length ? (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger className="py-4 text-[13px] font-medium tracking-[0.08em] uppercase no-underline hover:no-underline">
                    {item.label}
                  </AccordionTrigger>
                  <AccordionContent className="[&_a]:no-underline [&_a]:hover:text-luxe-black">
                    <ul className="space-y-3 pl-1">
                      <li>
                        <Link
                          href={item.href}
                          onClick={close}
                          className="block text-sm font-medium text-luxe-black"
                        >
                          {t("viewAll", { label: item.label })}
                        </Link>
                      </li>
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
                {t("account")}
              </Link>
            </li>
            <li>
              <Link href="/wishlist" onClick={close} className="no-underline">
                {t("wishlist")}
              </Link>
            </li>
          </ul>

          {supportLinks.length > 0 ? (
            <ul className="mt-5 flex flex-col gap-3 border-t border-border pt-5 text-sm text-luxe-gray-dark">
              {supportLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} onClick={close} className="no-underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
