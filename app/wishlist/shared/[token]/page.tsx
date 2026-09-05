import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Heart } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductCard } from "@/components/product/ProductCard";
import { getNavigation, getSiteSettings } from "@/services";
import { getProductsByIds } from "@/services/products";
import { getWishlistByShareToken } from "@/services/wishlists";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return {
  title: t("sharedWishlistTitle"),
  robots: { index: false, follow: false },
  };
}

interface SharedWishlistPageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedWishlistPage({ params }: SharedWishlistPageProps) {
  const t = await getTranslations("Pages");
  const { token } = await params;
  const [wishlist, navigation, settings] = await Promise.all([
    getWishlistByShareToken(token),
    getNavigation(),
    getSiteSettings(),
  ]);
  if (!wishlist) notFound();

  const products = await getProductsByIds(wishlist.items.map((item) => item.productId));

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main id="main" className="flex-1 pt-header">
        <div className="container-luxe py-10 md:py-14">
          <h1 className="font-heading text-3xl">{t("sharedWishlistHeading")}</h1>
          <p className="mt-2 text-sm text-luxe-gray-dark">Someone shared these picks with you.</p>

          {products.length === 0 ? (
            <div className="mt-16 flex flex-col items-center gap-4 py-16 text-center">
              <Heart className="size-12 text-luxe-gray-dark" strokeWidth={1} />
              <p className="text-sm text-luxe-gray-dark">This wishlist is empty.</p>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
