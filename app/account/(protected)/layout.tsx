import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { RequireAuthShell } from "@/components/account/RequireAuthShell";
import { getNavigation, getSiteSettings } from "@/services";
import { requireCustomerSessionOrRedirect } from "@/lib/customer-session";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ProtectedAccountLayout({ children }: { children: React.ReactNode }) {
  // Belt-and-suspenders alongside proxy.ts (which now also gates /account/*) and the
  // existing client-side RequireAuthShell — same pattern as the admin dashboard layout.
  await requireCustomerSessionOrRedirect();
  const [navigation, settings] = await Promise.all([getNavigation(), getSiteSettings()]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main id="main" className="flex-1 pt-header">
        <RequireAuthShell>{children}</RequireAuthShell>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
