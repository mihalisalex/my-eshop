import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { RegisterForm } from "@/components/account/RegisterForm";
import { getNavigation, getSiteSettings } from "@/services";
import { getConfiguredOAuthProviders } from "@/lib/oauth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return {
  title: t("createAccountTitle"),
  robots: { index: false, follow: false },
  };
}

export default async function RegisterPage() {
  const [navigation, settings] = await Promise.all([getNavigation(), getSiteSettings()]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main id="main" className="flex-1 pt-header">
        <div className="container-luxe py-16 md:py-24">
          <RegisterForm configuredOAuthProviders={getConfiguredOAuthProviders()} />
        </div>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
