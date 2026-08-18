import Link from "next/link";
import type { NavigationConfig, SiteSettings } from "@/types";
import { NewsletterForm } from "@/components/shared/NewsletterForm";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { getAcceptedPaymentMethodNames } from "@/services/payments";
import { COMPANY, traderIdentityLine } from "@/constants/company";

interface FooterProps {
  navigation: NavigationConfig;
  settings: SiteSettings;
}

/**
 * The accepted-payment badges used to be a hardcoded
 * ["Visa","Mastercard","Amex","PayPal"] — four claims on every page of a shop that could
 * only take cash on delivery, one of them (PayPal) not implemented anywhere. They are now
 * read from the same configuration the checkout uses, so the footer cannot advertise
 * something the checkout won't offer, and renders nothing at all when no method is live
 * rather than falling back to a plausible-looking list.
 *
 * Resolved here rather than passed in as a prop: the Footer already has ~30 call sites,
 * all of which would otherwise need threading a value none of them care about.
 */
export async function Footer({ navigation, settings }: FooterProps) {
  const year = new Date().getFullYear();
  const paymentMethods = await getAcceptedPaymentMethodNames();

  return (
    <footer className="border-t border-border bg-luxe-white">
      <div className="container-luxe grid grid-cols-2 gap-10 py-16 md:grid-cols-6 md:gap-8 lg:py-20">
        <div className="col-span-2 md:col-span-2">
          <p className="font-heading text-xl tracking-[0.1em] uppercase">{settings.siteName}</p>
          <p className="mt-3 max-w-xs text-sm text-luxe-gray-dark">{settings.tagline}</p>
          <div className="mt-6 max-w-xs">
            <NewsletterForm compact source="footer" />
          </div>
          {/* Rendered only when there is something to list. An empty <ul> collapses to zero
              height but keeps its mt-6, leaving 24px of dead space under the newsletter form —
              which is the state the shop is in until real social profiles are configured. */}
          {settings.socialLinks.length > 0 ? (
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
          ) : null}
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

      {/* Greek and EU law require the trader’s identity, registered address and VAT number
          to be reachable from any page of a commercial site — the footer is where a shopper
          looks for it, and it costs one line. */}
      <div className="border-t border-border">
        <div className="container-luxe py-4">
          <p className="text-xs text-luxe-gray-dark">{traderIdentityLine()}</p>
          <p className="mt-1 text-xs text-luxe-gray-dark">
            <a href={`mailto:${COMPANY.email}`} className="underline underline-offset-2">{COMPANY.email}</a>
            {" · "}
            <a href={`tel:${COMPANY.phoneE164}`} className="underline underline-offset-2">{COMPANY.phone}</a>
          </p>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-luxe flex flex-col-reverse items-center justify-between gap-4 py-6 md:flex-row">
          <div className="flex items-center gap-4">
            <p className="text-xs text-luxe-gray-dark">
              &copy; {year} {settings.siteName}. All rights reserved.
            </p>
            <LanguageSwitcher />
          </div>
          {paymentMethods.length > 0 ? (
            <ul className="flex flex-wrap items-center gap-2">
              {paymentMethods.map((method) => (
                <li
                  key={method}
                  className="rounded-none border border-border px-2.5 py-1 text-[10px] tracking-[0.05em] text-luxe-gray-dark uppercase"
                >
                  {method}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
