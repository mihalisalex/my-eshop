import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
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
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${playfairDisplay.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before first paint, so a visitor who has already answered the cookie banner
            never sees it flash. The banner itself is server-rendered (see
            CookieConsentBanner) because it sits in the viewport and was otherwise the
            homepage's LCP element, painting only after hydration. Reading localStorage is
            the one thing the server cannot do, so it is done here instead of deferring the
            whole banner to an effect. Kept inline and dependency-free: an external file
            would be a network round trip in front of first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('alexandris_cookie_consent'))document.documentElement.dataset.consent='set'}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <JsonLd data={organizationSchema(seo)} />
        <JsonLd data={websiteSchema(seo)} />
        <NextIntlClientProvider messages={messages}>
          {/* Deliberately ahead of {children}. It is position:fixed, so DOM order does not
              affect where it appears — but it does decide when it appears. Sitting after
              {children} meant its markup only flushed once the page's slowest server
              component had finished streaming, so this banner painted ~3.3s in and became
              the homepage's LCP element. Emitted first, it paints with the shell.
              Stacking is unaffected: the cart drawer portals to the end of <body>, the
              toast viewport is z-200, and the header is top-fixed with no overlap. */}
          <CookieConsentBanner />
          <ToastProvider>
            <CartProvider>
              <WishlistProvider>
                <AuthProvider>{children}</AuthProvider>
              </WishlistProvider>
              <CartDrawer />
            </CartProvider>
            <ToastViewport />
          </ToastProvider>
          <ReferralCapture />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
