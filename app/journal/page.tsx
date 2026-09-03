import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { formatDate } from "@/lib/format";
import { getAllPosts, getNavigation, getSiteSettings } from "@/services";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return { title: t("journalTitle"), description: t("journalSubtitle") };
}

export default async function JournalPage() {
  const [navigation, settings, posts, t] = await Promise.all([
    getNavigation(),
    getSiteSettings(),
    getAllPosts(),
    getTranslations("Pages"),
  ]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main id="main" className="flex-1 pt-header">
        <div className="container-luxe py-10 md:py-14">
          <h1 className="font-heading text-4xl">{t("journalTitle")}</h1>
          <p className="mt-2 text-luxe-gray-dark">{t("journalSubtitle")}</p>

          <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.id} href={`/journal/${post.slug}`} className="group block">
                <div className="relative aspect-4/3 overflow-hidden bg-luxe-gray-light">
                  <Image
                    src={post.coverImage.src}
                    alt={post.coverImage.alt}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                </div>
                <p className="mt-4 text-eyebrow">{formatDate(post.publishedAt)}</p>
                <h2 className="mt-1 font-heading text-xl">{post.title}</h2>
                <p className="mt-2 text-sm text-luxe-gray-dark">{post.excerpt}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
