import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { JsonLd } from "@/components/shared/JsonLd";
import { organizationSchema, websiteSchema } from "@/lib/seo";
import { getSeoDefaults } from "@/services";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { CartProvider } from "@/components/providers/CartProvider";
import { WishlistProvider } from "@/components/providers/WishlistProvider";
import { ToastViewport } from "@/components/shared/ToastViewport";
import { CookieConsentBanner } from "@/components/shared/CookieConsentBanner";
import { ReferralCapture } from "@/components/shared/ReferralCapture";
import { CartDrawer } from "@/components/cart/CartDrawer";
import "./globals.css";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoDefaults();

  return {
    metadataBase: new URL(seo.siteUrl),
    title: {
      template: seo.titleTemplate,
      default: seo.defaultTitle,
    },
    description: seo.defaultDescription,
    applicationName: seo.organization.name,
    openGraph: {
      type: "website",
      siteName: seo.organization.name,
      images: [{ url: seo.defaultOgImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      creator: seo.twitterHandle,
    },
    icons: {
      icon: "/icon.svg",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const seo = await getSeoDefaults();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <JsonLd data={organizationSchema(seo)} />
        <JsonLd data={websiteSchema(seo)} />
        <ToastProvider>
          <CartProvider>
            <WishlistProvider>
              <AuthProvider>{children}</AuthProvider>
            </WishlistProvider>
            <CartDrawer />
          </CartProvider>
          <ToastViewport />
        </ToastProvider>
        <CookieConsentBanner />
        <ReferralCapture />
      </body>
    </html>
  );
}
