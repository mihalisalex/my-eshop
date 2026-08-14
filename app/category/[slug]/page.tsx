import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductListingPage } from "@/components/plp/ProductListingPage";
import { getAllCategories, getCategoryBySlug, getChildCategories, getNavigation, getSiteSettings, getSeoDefaults } from "@/services";
import { localizeCategory, localizeCategories } from "@/lib/localize";
import { buildMetadata } from "@/lib/seo";
import { ROUTES } from "@/constants/routes";
import type { Locale } from "@/i18n/config";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const categories = await getAllCategories();
  return categories.filter((c) => c.isVisible).map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [category, seo] = await Promise.all([getCategoryBySlug(slug), getSeoDefaults()]);
  if (!category || !category.isVisible) return {};
  return buildMetadata({
    seo,
    title: category.seo?.title ?? category.name,
    description: category.seo?.description ?? category.description,
    path: ROUTES.category(category.slug),
    image: category.seo?.ogImage ?? category.bannerImage?.src ?? category.image?.src,
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const rawCategory = await getCategoryBySlug(slug);
  // Hidden categories 404 publicly (same convention as a draft page) — the admin can still
  // reach them directly at /admin/categories/[id] regardless of isVisible.
  if (!rawCategory || !rawCategory.isVisible) notFound();

  const [navigation, settings, locale, rawChildren] = await Promise.all([
    getNavigation(),
    getSiteSettings(),
    getLocale(),
    getChildCategories(rawCategory.id),
  ]);
  const category = localizeCategory(rawCategory, locale as Locale);
  const children = localizeCategories(
    rawChildren.filter((c) => c.isVisible),
    locale as Locale
  );

  const heroImage = category.bannerImage ?? category.image;

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main className="flex-1 pt-header">
        {heroImage ? (
          <div className="relative h-64 w-full overflow-hidden bg-luxe-gray-light md:h-80">
            <Image src={heroImage.src} alt={heroImage.alt} fill sizes="100vw" className="object-cover" priority />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 text-center text-luxe-white">
              <h1 className="font-heading text-3xl md:text-5xl">{category.name}</h1>
              {category.description ? (
                <p className="mt-2 max-w-xl px-4 text-sm tracking-[0.02em] md:text-base">{category.description}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="container-luxe py-10 md:py-14">
            <h1 className="font-heading text-3xl md:text-5xl">{category.name}</h1>
            {category.description ? <p className="mt-3 max-w-xl text-luxe-gray-dark">{category.description}</p> : null}
          </div>
        )}

        {children.length > 0 ? (
          <div className="container-luxe flex flex-wrap gap-2 pt-8">
            {children.map((child) => (
              <Link
                key={child.id}
                href={ROUTES.category(child.slug)}
                className="border border-border px-4 py-2 text-xs font-medium tracking-[0.05em] uppercase transition-colors hover:border-luxe-black"
              >
                {child.name}
              </Link>
            ))}
          </div>
        ) : null}

        <Suspense fallback={null}>
          {/* Always false — one of the two branches above has already rendered the
              category's name (and description), same as app/collections/[slug]/page.tsx. */}
          <ProductListingPage title={category.name} baseFilters={{ category: category.slug }} showHeader={false} />
        </Suspense>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
