import { CheckoutProvider } from "@/components/providers/CheckoutProvider";
import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";
import { getSiteSettings } from "@/services";

export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();

  return (
    <CheckoutProvider>
      <CheckoutHeader siteName={settings.siteName} />
      <main id="main" className="flex-1 bg-luxe-white">{children}</main>
    </CheckoutProvider>
  );
}
