import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductListingSection } from "@/components/plp/ProductListingSection";
import {
  getAllCategories,
  getCategoryBySlug,
  getChildCategories,
  getNavigation,
  getSiteSettings,
  getSeoDefaults,
  resolveRenamedCategorySlug,
} from "@/services";
import { localizeCategory, localizeCategories } from "@/lib/localize";
import { buildMetadata } from "@/lib/seo";
import { ROUTES } from "@/constants/routes";
import type { Locale } from "@/i18n/config";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  /** Awaited in the page body so the product grid can be rendered server-side — see ProductListingSection. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateStaticParams() {
  const categories = await getAllCategories();
  return categories.filter((c) => c.isVisible).map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [raw, seo, locale] = await Promise.all([getCategoryBySlug(slug), getSeoDefaults(), getLocale()]);
  if (!raw || !raw.isVisible) return {};
  // Localized here as well as in the page body, which was already doing it. A Greek heading
  // under an English <title> is invisible on screen and is precisely what a crawler indexes.
  const category = localizeCategory(raw, locale as Locale);
  // `||`, not `??` — same empty-string-is-not-absent reasoning as the product page.
  return buildMetadata({
    seo,
    title: category.seo?.title || category.name,
    description: category.seo?.description || category.description,
    path: ROUTES.category(category.slug),
    image: category.seo?.ogImage || category.bannerImage?.src || category.image?.src,
    locale: locale as Locale,
  });
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const rawCategory = await getCategoryBySlug(slug);

  if (!rawCategory) {
    // Backstop only. proxy.ts already 308s renamed slugs before the request reaches here,
    // which is what search engines need; this catches anything that bypassed the proxy.
    //
    // It cannot replace the proxy: this route streams, and the Next docs are explicit that
    // `permanentRedirect` in a streaming context emits a client-side
    // `<meta http-equiv="refresh">` rather than a 308 response. That still moves a human to
    // the right page, but it's a soft redirect — exactly the wrong thing when the entire
    // point is preserving the old URL's search ranking.
    const currentSlug = await resolveRenamedCategorySlug(slug);
    if (currentSlug) permanentRedirect(ROUTES.category(currentSlug));
  }

  // Hidden categories 404 publicly (same convention as a draft page) — the admin can still
  // reach them directly at /admin/categories/[id] regardless of isVisible.
  if (!rawCategory || !rawCategory.isVisible) notFound();

  const [navigation, settings, locale, rawChildren, resolvedSearchParams] = await Promise.all([
    getNavigation(),
    getSiteSettings(),
    getLocale(),
    getChildCategories(rawCategory.id),
    searchParams,
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
          <ProductListingSection
            title={category.name}
            baseFilters={{ category: category.slug }}
            showHeader={false}
            searchParams={resolvedSearchParams}
          />
        </Suspense>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
