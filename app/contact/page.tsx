import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ContactForm } from "@/components/shared/ContactForm";
import { getNavigation, getSiteSettings } from "@/services";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return {
  title: t("contactTitle"),
  };
}

export default async function ContactPage() {
  const t = await getTranslations("Pages");
  const [navigation, settings] = await Promise.all([getNavigation(), getSiteSettings()]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main className="flex-1 pt-header">
        <div className="container-luxe max-w-3xl py-14 md:py-20">
          <h1 className="font-heading text-4xl md:text-5xl">{t("contactTitle")}</h1>
          <p className="mt-4 text-lg text-luxe-gray-dark">
            Questions about an order, a product, or anything else — we usually reply within 1 business day.
          </p>
          <p className="mt-2 text-sm text-luxe-gray-dark">
            Prefer email? Write to us directly at{" "}
            <a href={`mailto:${settings.contactEmail}`} className="underline underline-offset-4">
              {settings.contactEmail}
            </a>
            .
          </p>

          <div className="mt-10">
            <ContactForm />
          </div>
        </div>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
