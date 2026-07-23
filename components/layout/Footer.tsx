import Link from "next/link";
import type { NavigationConfig, SiteSettings } from "@/types";
import { NewsletterForm } from "@/components/shared/NewsletterForm";

interface FooterProps {
  navigation: NavigationConfig;
  settings: SiteSettings;
}

const PAYMENT_METHODS = ["Visa", "Mastercard", "Amex", "PayPal"];

export function Footer({ navigation, settings }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-luxe-white">
      <div className="container-luxe grid grid-cols-2 gap-10 py-16 md:grid-cols-6 md:gap-8 lg:py-20">
        <div className="col-span-2 md:col-span-2">
          <p className="font-heading text-xl tracking-[0.1em] uppercase">{settings.siteName}</p>
          <p className="mt-3 max-w-xs text-sm text-luxe-gray-dark">{settings.tagline}</p>
          <div className="mt-6 max-w-xs">
            <NewsletterForm compact />
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs tracking-[0.05em] text-luxe-gray-dark uppercase">
            {settings.socialLinks.map((social) => (
              <li key={social.platform}>
                <a
                  href={social.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="transition-colors hover:text-luxe-black"
                >
                  {social.platform}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {navigation.footer.map((column) => (
          <div key={column.title}>
            <p className="text-xs font-medium tracking-[0.1em] uppercase">{column.title}</p>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-luxe-gray-dark transition-colors hover:text-luxe-black"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="container-luxe flex flex-col-reverse items-center justify-between gap-4 py-6 md:flex-row">
          <p className="text-xs text-luxe-gray-dark">
            &copy; {year} {settings.siteName}. All rights reserved.
          </p>
          <ul className="flex items-center gap-2">
            {PAYMENT_METHODS.map((method) => (
              <li
                key={method}
                className="rounded-none border border-border px-2.5 py-1 text-[10px] tracking-[0.05em] text-luxe-gray-dark uppercase"
              >
                {method}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
