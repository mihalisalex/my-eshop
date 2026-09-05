import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getAboutPage, getNavigation, getSiteSettings } from "@/services";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return {
  title: t("aboutTitle"),
  };
}

export default async function AboutPage() {
  const [navigation, settings, about] = await Promise.all([getNavigation(), getSiteSettings(), getAboutPage()]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main id="main" className="flex-1 pt-header">
        <div className="relative h-72 w-full overflow-hidden bg-luxe-gray-light md:h-96">
          <Image src={about.heroImage.src} alt={about.heroImage.alt} fill sizes="100vw" className="object-cover" priority />
        </div>

        <div className="container-luxe max-w-3xl py-14 md:py-20">
          <h1 className="font-heading text-4xl md:text-5xl">{about.title}</h1>
          <p className="mt-4 text-lg text-luxe-gray-dark">{about.intro}</p>

          <div className="mt-14 space-y-14">
            {about.sections.map((section) => (
              <div key={section.heading}>
                <h2 className="font-heading text-2xl">{section.heading}</h2>
                <p className="mt-3 text-luxe-gray-dark">{section.body}</p>
                {section.image ? (
                  <div className="relative mt-6 aspect-16/9 w-full overflow-hidden bg-luxe-gray-light">
                    <Image src={section.image.src} alt={section.image.alt} fill sizes="768px" className="object-cover" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
