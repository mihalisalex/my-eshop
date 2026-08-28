import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { localizeProduct, localizeProducts } from "@/lib/localize";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Breadcrumbs } from "@/components/product/Breadcrumbs";
import { Gallery } from "@/components/product/Gallery";
import { PurchasePanel } from "@/components/product/PurchasePanel";
import { ProductAccordion } from "@/components/product/ProductAccordion";
import { ReviewsSection } from "@/components/product/ReviewsSection";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import { RecentlyViewedSection } from "@/components/product/RecentlyViewedSection";
import { JsonLd } from "@/components/shared/JsonLd";
import { buildMetadata, breadcrumbSchema, productSchema } from "@/lib/seo";
import {
  getAllProducts,
  getNavigation,
  getProductBySlug,
  getRelatedProducts,
  getReviewsForProduct,
  getReviewSummary,
  getSeoDefaults,
  getSiteSettings,
  getCategoryById,
} from "@/services";
import { ROUTES } from "@/constants/routes";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [rawProduct, seo, locale] = await Promise.all([getProductBySlug(slug), getSeoDefaults(), getLocale()]);
  if (!rawProduct) return {};
  const product = localizeProduct(rawProduct, locale as Locale);

  // `||`, not `??`: an override saved through the admin form with its optional SEO
  // block left blank is stored as "" rather than absent, and `??` would hand that
  // empty string straight to the <title>. See normalizeSeoOverride in
  // lib/validation/product.ts — that stops NEW rows being written this way, this
  // makes rows already written that way render their real name.
  return buildMetadata({
    seo,
    title: product.seo?.title || product.name,
    description: product.seo?.description || product.description,
    path: `/products/${product.slug}`,
    image: product.seo?.ogImage || product.images[0]?.src,
    locale: locale as "en" | "el",
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const t = await getTranslations("Pdp");
  const { slug } = await params;
  const rawProduct = await getProductBySlug(slug);
  if (!rawProduct) notFound();

  const [navigation, settings, seo, rawRelated, reviews, reviewSummary, locale, category] = await Promise.all([
    getNavigation(),
    getSiteSettings(),
    getSeoDefaults(),
    getRelatedProducts(rawProduct.id, 4),
    getReviewsForProduct(rawProduct.id),
    getReviewSummary(rawProduct.id),
    getLocale(),
    getCategoryById(rawProduct.categoryId),
  ]);
  const product = localizeProduct(rawProduct, locale as Locale);
  const related = localizeProducts(rawRelated, locale as Locale);

  const breadcrumbItems = [
    { name: "Home", href: "/" },
    // Was `/${product.category}` — a dead link (no such top-level route ever existed).
    // Now a real page: app/category/[slug]/page.tsx, with the category's real display
    // name instead of a crudely capitalized slug.
    ...(category ? [{ name: category.name, href: ROUTES.category(category.slug) }] : []),
    { name: product.name, href: `/products/${product.slug}` },
  ];

  return (
    <>
      <JsonLd data={productSchema(product, seo.siteUrl)} />
      <JsonLd data={breadcrumbSchema(breadcrumbItems, seo.siteUrl)} />

      <Header
        navigation={navigation}
        siteName={settings.siteName}
        announcementMessages={settings.announcementMessages}
      />

      <main className="flex-1 pt-header">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="container-luxe grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <Gallery images={product.images} videos={product.videos} productName={product.name} />

          <div>
            <div className="lg:sticky lg:top-[132px]">
              <PurchasePanel product={product} />
            </div>
          </div>
        </div>

        <div className="container-luxe">
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-16">
            <div />
            <ProductAccordion product={product} />
          </div>

          <ReviewsSection summary={reviewSummary} reviews={reviews} />
          <RelatedProducts title={t("youMayAlsoLike")} products={related} />
          <RecentlyViewedSection currentProductId={product.id} />
        </div>
      </main>

      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
