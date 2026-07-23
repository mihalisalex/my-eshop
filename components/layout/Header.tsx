"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Search, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrolled } from "@/hooks/use-scrolled";
import { Logo } from "@/components/layout/Logo";
import { DesktopNav } from "@/components/layout/DesktopNav";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { SearchOverlay } from "@/components/layout/SearchOverlay";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { IconButton } from "@/components/shared/IconButton";
import { useCart } from "@/components/providers/CartProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";
import type { NavigationConfig } from "@/types";

interface HeaderProps {
  navigation: NavigationConfig;
  siteName: string;
  announcementMessages: string[];
  /** Homepage renders the header over a fullscreen hero, so it starts transparent with light text. */
  transparent?: boolean;
}

export function Header({
  navigation,
  siteName,
  announcementMessages,
  transparent = false,
}: HeaderProps) {
  const scrolled = useScrolled(40);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { itemCount: cartCount, openDrawer } = useCart();
  const { productIds: wishlistIds } = useWishlist();
  const wishlistCount = wishlistIds.size;

  const isLight = transparent && !scrolled;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40">
        <AnnouncementBar messages={announcementMessages} />
        <header
          className={cn(
            "transition-colors duration-300",
            isLight ? "bg-transparent" : "border-b border-border bg-luxe-white"
          )}
        >
          <div className="container-luxe flex h-18 items-center justify-between md:h-20">
            <div className="flex items-center gap-4">
              <MobileMenu
                items={navigation.primary}
                open={mobileOpen}
                onOpenChange={setMobileOpen}
                triggerLight={isLight}
              />
              <Logo siteName={siteName} className={isLight ? "text-luxe-white" : "text-luxe-black"} />
            </div>

            <DesktopNav items={navigation.primary} transparentText={isLight} />

            <div className={cn("flex items-center gap-5", isLight ? "text-luxe-white" : "text-luxe-black")}>
              <IconButton label="Search" onClick={() => setSearchOpen(true)}>
                <Search className="size-5" strokeWidth={1.5} />
              </IconButton>
              <Link href="/wishlist" aria-label="Wishlist" className="relative hidden sm:inline-flex">
                <Heart className="size-5" strokeWidth={1.5} />
                {wishlistCount > 0 ? (
                  <span className="absolute -top-2 -right-2 flex size-4 items-center justify-center rounded-full bg-luxe-black text-[9px] text-luxe-white">
                    {wishlistCount}
                  </span>
                ) : null}
              </Link>
              <Link href="/account" aria-label="Account" className="hidden sm:inline-flex">
                <User className="size-5" strokeWidth={1.5} />
              </Link>
              <button type="button" aria-label="Cart" onClick={openDrawer} className="relative inline-flex">
                <ShoppingBag className="size-5" strokeWidth={1.5} />
                {cartCount > 0 ? (
                  <span className="absolute -top-2 -right-2 flex size-4 items-center justify-center rounded-full bg-luxe-black text-[9px] text-luxe-white">
                    {cartCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </header>
      </div>
      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
