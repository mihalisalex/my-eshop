import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { localizeCategory, localizeProduct, localizeProducts } from "@/lib/localize";
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
import { resolveProductSeo } from "@/lib/seo/resolve";
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
  resolveRenamedProductSlug,
} from "@/services";
import { ROUTES } from "@/constants/routes";
import { getShippingRates } from "@/services/shipping";

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

  // Every fallback rule lives in resolveProductSeo, not here — see lib/seo/resolve.ts for
  // why five call sites each doing their own `||` chain is how the empty-string bug got in.
  const resolved = resolveProductSeo(product, { seo });
  return buildMetadata({
    seo,
    title: resolved.title,
    description: resolved.description,
    canonical: resolved.canonical,
    noIndex: resolved.noIndex,
    ogTitle: resolved.ogTitle,
    ogDescription: resolved.ogDescription,
    image: resolved.ogImage,
    locale: locale as "en" | "el",
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  // Shipping rates come from the settings the admin edits, so the threshold and the
  // delivery windows on this page are whatever was last saved rather than literals.
  const [t, tNav, shippingRates] = await Promise.all([
    getTranslations("Pdp"),
    getTranslations("Nav"),
    getShippingRates(),
  ]);
  const { slug } = await params;
  const rawProduct = await getProductBySlug(slug);

  if (!rawProduct) {
    // Backstop only. proxy.ts already 308s renamed slugs before the request reaches here,
    // which is what search engines need; this catches anything that bypassed the proxy.
    //
    // It cannot replace the proxy: this route streams, and Next emits a client-side
    // `<meta http-equiv="refresh">` rather than a 308 when `permanentRedirect` is called
    // in a streaming context. That still moves a human to the right page, but it passes no
    // ranking on — which is the entire point of preserving the old URL.
    const currentSlug = await resolveRenamedProductSlug(slug);
    if (currentSlug) permanentRedirect(ROUTES.product(currentSlug));
    notFound();
  }

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

  // Built by the resolver so the crumb the reader sees and the crumb Google reads come
  // from one place, and so the category link cannot drift from the metadata's idea of it.
  const { breadcrumbs: breadcrumbItems } = resolveProductSeo(product, {
    seo,
    // Localised, like every other category name on the storefront. Unlocalised, the
    // breadcrumb read "Home > Sandals > <Greek product name>" on a Greek shop — on screen
    // AND inside BreadcrumbList, which is the copy Google reads.
    category: category
      ? { name: localizeCategory(category, locale as Locale).name, slug: category.slug }
      : undefined,
    homeLabel: tNav("home"),
  });

  return (
    <>
      <JsonLd data={productSchema(product, seo.siteUrl, reviewSummary)} />
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
              <PurchasePanel product={product} rates={shippingRates} />
            </div>
          </div>
        </div>

        <div className="container-luxe">
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-16">
            <div />
            <ProductAccordion product={product} rates={shippingRates} />
          </div>

          <ReviewsSection summary={reviewSummary} reviews={reviews} productId={product.id} />
          <RelatedProducts title={t("youMayAlsoLike")} products={related} />
          <RecentlyViewedSection currentProductId={product.id} />
        </div>
      </main>

      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
