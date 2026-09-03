import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getDeliveryEstimate, parseDeliveryWindow } from "@/lib/delivery";
import { formatMoney } from "@/lib/format";
import { useTranslations } from "next-intl";
import type { Product } from "@/types";
import type { ShippingRate } from "@/lib/commerce/types";

interface ProductAccordionProps {
  product: Product;
  /** Only the rates a shopper can actually pick — see services/shipping.ts. */
  rates: ShippingRate[];
}

/**
 * Concrete dates where the rate states a day range, its own words where it does not.
 *
 * "Παράδοση τη Δευτέρα 8 Σεπτεμβρίου" answers the question a shopper is really asking;
 * "3–5 εργάσιμες ημέρες" makes them count. But a rate worded without numbers cannot be
 * turned into dates, and guessing at one would be worse than repeating what it says.
 */
function describeArrival(estimate: string): string {
  const window = parseDeliveryWindow(estimate);
  return window ? getDeliveryEstimate(window[0], window[1]) : estimate;
}

const TRIGGER_CLASS =
  "py-4 text-sm font-medium tracking-[0.05em] uppercase no-underline hover:no-underline";

/**
 * Sections render only when they have something to say.
 *
 * "Fit & Composition" used to open with a hardcoded, per-gender line — "Model is 186cm /
 * 6'1\" wearing size M. Fits true to size." — on a FOOTWEAR product, where a model's
 * height and a garment size mean nothing and no such model exists. Below it sat a
 * Materials list built from `product.materials`, which is empty for all 175 products, so
 * the section was a fabricated sentence above an empty bullet list. "Care Instructions"
 * was worse: an empty <ul> and nothing else, on every product.
 *
 * Both are now driven by the data. When materials or care instructions are actually
 * entered on a product they appear; when they aren't, the section is absent rather than
 * present-and-empty. Shipping and Returns are always shown because they are real store
 * policy rather than per-product data.
 */
export function ProductAccordion({ product, rates }: ProductAccordionProps) {
  const t = useTranslations("Pdp");
  const hasMaterials = product.materials.length > 0;
  const hasCare = product.careInstructions.length > 0;
  // The threshold lives on each rate (buildShippingRates folds it in), so it is whatever
  // the admin last saved rather than a number written into this file.
  // As Money, not a bare number: formatMoney renders the currency, and the threshold is
  // denominated in whatever the rate it belongs to is priced in.
  const freeShippingRate = rates.find((rate) => rate.freeOverAmount != null);
  const freeOver = freeShippingRate?.freeOverAmount != null
    ? { amount: freeShippingRate.freeOverAmount, currencyCode: freeShippingRate.price.currencyCode }
    : null;

  return (
    <Accordion className="border-t border-border">
      {hasMaterials ? (
        <AccordionItem value="composition">
          <AccordionTrigger className={TRIGGER_CLASS}>{t("composition")}</AccordionTrigger>
          <AccordionContent>
            <ul className="list-inside list-disc text-sm text-luxe-gray-dark">
              {product.materials.map((material) => (
                <li key={material}>{material}</li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ) : null}

      {hasCare ? (
        <AccordionItem value="care">
          <AccordionTrigger className={TRIGGER_CLASS}>{t("careInstructions")}</AccordionTrigger>
          <AccordionContent>
            <ul className="list-inside list-disc text-sm text-luxe-gray-dark">
              {product.careInstructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ) : null}

      {/*
        One line per rate the shop actually offers, from the shipping settings.
        Previously both a "Standard" and an "Express" line were hardcoded, with hardcoded
        3–5 and 1–2 day windows and a hardcoded €150 threshold — so the page advertised
        express delivery months after it had been switched off in the admin, and quoted a
        threshold the announcement bar above it already contradicted.
      */}
      <AccordionItem value="shipping">
        <AccordionTrigger className={TRIGGER_CLASS}>{t("shipping")}</AccordionTrigger>
        <AccordionContent>
          {rates.map((rate) => (
            <p key={rate.id} className="text-sm text-luxe-gray-dark first:mt-0 mt-1">
              {rate.label}: <span className="text-luxe-black">{describeArrival(rate.estimatedDelivery)}</span>
            </p>
          ))}
          {freeOver ? (
            <p className="mt-3 text-sm text-luxe-gray-dark">
              {t("freeShippingOver", { amount: formatMoney(freeOver) })}
            </p>
          ) : null}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="returns">
        <AccordionTrigger className={TRIGGER_CLASS}>{t("returns")}</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-luxe-gray-dark">{t("returnsBody")}</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
