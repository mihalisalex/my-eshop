import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductCard } from "@/components/product/ProductCard";
import { getAllCampaigns, getCampaignBySlug, getNavigation, getPublishedProductsByIds, getSiteSettings } from "@/services";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

interface CampaignPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const campaigns = await getAllCampaigns();
  return campaigns.map((campaign) => ({ slug: campaign.slug }));
}

export async function generateMetadata({ params }: CampaignPageProps): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getCampaignBySlug(slug);
  if (!campaign) return {};
  return { title: campaign.title, description: campaign.description };
}

export default async function CampaignPage({ params }: CampaignPageProps) {
  const { slug } = await params;
  const campaign = await getCampaignBySlug(slug);
  if (!campaign) notFound();

  const [navigation, settings, products] = await Promise.all([
    getNavigation(),
    getSiteSettings(),
    campaign.productIds ? getPublishedProductsByIds(campaign.productIds) : Promise.resolve([]),
  ]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main id="main" className="flex-1 pt-header">
        <div className="relative h-80 w-full overflow-hidden bg-luxe-gray-light md:h-[28rem]">
          <Image src={campaign.heroImage.src} alt={campaign.heroImage.alt} fill sizes="100vw" className="object-cover" priority />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 px-6 text-center text-luxe-white">
            <h1 className="font-heading text-4xl md:text-5xl">{campaign.title}</h1>
            {campaign.subtitle ? <p className="mt-3 max-w-xl text-sm md:text-base">{campaign.subtitle}</p> : null}
            {campaign.cta ? (
              <Link
                href={campaign.cta.href}
                className="mt-6 flex h-12 items-center justify-center bg-luxe-white px-8 text-xs font-medium tracking-[0.08em] text-luxe-black uppercase"
              >
                {campaign.cta.label}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="container-luxe max-w-2xl py-10 text-center md:py-14">
          <p className="text-luxe-gray-dark">{campaign.description}</p>
        </div>

        {products.length > 0 ? (
          <div className="container-luxe pb-16">
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
