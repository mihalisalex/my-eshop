import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SimplePageContent } from "@/components/shared/SimplePageContent";
import { getLegalPages, getLegalPage, getNavigation, getSiteSettings } from "@/services";

interface LegalPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const pages = await getLegalPages();
  return pages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getLegalPage(slug);
  if (!page) return {};
  return { title: page.title };
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { slug } = await params;
  const page = await getLegalPage(slug);
  if (!page) notFound();

  const [navigation, settings] = await Promise.all([getNavigation(), getSiteSettings()]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main className="flex-1 pt-header">
        <SimplePageContent page={page} />
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
