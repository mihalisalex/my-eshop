import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductCard } from "@/components/product/ProductCard";
import { getAllLookbooks, getLookbookBySlug, getNavigation, getPublishedProductsByIds, getSiteSettings } from "@/services";
import { getTranslations } from "next-intl/server";

interface LookbookPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const lookbooks = await getAllLookbooks();
  return lookbooks.map((lookbook) => ({ slug: lookbook.slug }));
}

export async function generateMetadata({ params }: LookbookPageProps): Promise<Metadata> {
  const { slug } = await params;
  const lookbook = await getLookbookBySlug(slug);
  if (!lookbook) return {};
  return { title: `${lookbook.title} Lookbook` };
}

export default async function LookbookPage({ params }: LookbookPageProps) {
  const t = await getTranslations("Pages");
  const { slug } = await params;
  const lookbook = await getLookbookBySlug(slug);
  if (!lookbook) notFound();

  const [navigation, settings, products] = await Promise.all([
    getNavigation(),
    getSiteSettings(),
    lookbook.productIds ? getPublishedProductsByIds(lookbook.productIds) : Promise.resolve([]),
  ]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main id="main" className="flex-1 pt-header">
        <div className="container-luxe py-10 md:py-14">
          <p className="text-eyebrow">{lookbook.season} Lookbook</p>
          <h1 className="mt-1 font-heading text-4xl">{lookbook.title}</h1>
        </div>

        <div className="container-luxe grid grid-cols-1 gap-4 sm:grid-cols-2">
          {lookbook.images.map((image, index) => (
            <div key={index} className="relative aspect-3/4 overflow-hidden bg-luxe-gray-light">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(min-width: 640px) 50vw, 100vw"
                className="object-cover"
                priority={index < 2}
              />
            </div>
          ))}
        </div>

        {products.length > 0 ? (
          <div className="container-luxe py-14">
            <h2 className="mb-6 font-heading text-2xl">{t("shopTheLookbook")}</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        ) : null}
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
