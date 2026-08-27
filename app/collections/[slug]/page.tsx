import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductListingPage } from "@/components/plp/ProductListingPage";
import { getAllCollections, getCollectionBySlug, getNavigation, getSiteSettings, getSeoDefaults } from "@/services";
import { localizeCollection } from "@/lib/localize";
import { buildMetadata } from "@/lib/seo";
import type { Locale } from "@/i18n/config";

interface CollectionPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const collections = await getAllCollections();
  return collections.map((collection) => ({ slug: collection.slug }));
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [raw, seo, locale] = await Promise.all([getCollectionBySlug(slug), getSeoDefaults(), getLocale()]);
  if (!raw) return {};
  // Localized here as well as in the page body. Without it the <title> and og:title stay
  // English while the visible heading is Greek — the body was localized and the metadata was
  // forgotten, which is invisible on screen and is exactly what a search engine reads.
  const collection = localizeCollection(raw, locale as Locale);
  return buildMetadata({
    seo,
    title: collection.title,
    description: collection.description ?? collection.subtitle,
    path: `/collections/${collection.slug}`,
    locale: locale as Locale,
  });
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const rawCollection = await getCollectionBySlug(slug);
  if (!rawCollection) notFound();

  const [navigation, settings, locale] = await Promise.all([getNavigation(), getSiteSettings(), getLocale()]);
  const collection = localizeCollection(rawCollection, locale as Locale);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main className="flex-1 pt-header">
        <div className="relative h-64 w-full overflow-hidden bg-luxe-gray-light md:h-80">
          <Image src={collection.image.src} alt={collection.image.alt} fill sizes="100vw" className="object-cover" priority />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 text-center text-luxe-white">
            <h1 className="font-heading text-3xl md:text-5xl">{collection.title}</h1>
            {collection.subtitle ? <p className="mt-2 text-sm tracking-[0.05em] uppercase md:text-base">{collection.subtitle}</p> : null}
          </div>
        </div>
        <Suspense fallback={null}>
          <ProductListingPage
            title={collection.title}
            description={collection.description}
            baseFilters={{ collectionId: collection.id }}
            showHeader={false}
          />
        </Suspense>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
