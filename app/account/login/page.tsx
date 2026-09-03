import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { LoginForm } from "@/components/account/LoginForm";
import { getNavigation, getSiteSettings } from "@/services";
import { getConfiguredOAuthProviders } from "@/lib/oauth";
import { isSafeRedirectPath } from "@/lib/oauth/state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return {
  title: t("signInTitle"),
  robots: { index: false, follow: false },
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const [navigation, settings, params] = await Promise.all([getNavigation(), getSiteSettings(), searchParams]);
  const from = params.from && isSafeRedirectPath(params.from) ? params.from : undefined;

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main id="main" className="flex-1 pt-header">
        <div className="container-luxe py-16 md:py-24">
          <LoginForm configuredOAuthProviders={getConfiguredOAuthProviders()} from={from} oauthError={params.error === "oauth"} />
        </div>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
