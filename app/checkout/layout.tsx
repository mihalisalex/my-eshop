import { CheckoutProvider } from "@/components/providers/CheckoutProvider";
import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";
import { getSiteSettings } from "@/services";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();

  return (
    <CheckoutProvider>
      <CheckoutHeader siteName={settings.siteName} />
      <main id="main" className="flex-1 bg-luxe-white">{children}</main>
    </CheckoutProvider>
  );
}
