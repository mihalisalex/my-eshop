import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
} from "@/services";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [product, seo] = await Promise.all([getProductBySlug(slug), getSeoDefaults()]);
  if (!product) return {};

  return buildMetadata({
    seo,
    title: product.seo?.title ?? product.name,
    description: product.seo?.description ?? product.description,
    path: `/products/${product.slug}`,
    image: product.seo?.ogImage ?? product.images[0]?.src,
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [navigation, settings, seo, related, reviews, reviewSummary] = await Promise.all([
    getNavigation(),
    getSiteSettings(),
    getSeoDefaults(),
    getRelatedProducts(product.id, 4),
    getReviewsForProduct(product.id),
    getReviewSummary(product.id),
  ]);

  const breadcrumbItems = [
    { name: "Home", href: "/" },
    { name: product.category.charAt(0).toUpperCase() + product.category.slice(1), href: `/${product.category}` },
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
          <RelatedProducts title="You May Also Like" products={related} />
          <RecentlyViewedSection currentProductId={product.id} />
        </div>
      </main>

      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
