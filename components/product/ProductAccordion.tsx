import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getDeliveryEstimate } from "@/lib/delivery";
import { useTranslations } from "next-intl";
import type { Product } from "@/types";

interface ProductAccordionProps {
  product: Product;
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
export function ProductAccordion({ product }: ProductAccordionProps) {
  const t = useTranslations("Pdp");
  const hasMaterials = product.materials.length > 0;
  const hasCare = product.careInstructions.length > 0;

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

      <AccordionItem value="shipping">
        <AccordionTrigger className={TRIGGER_CLASS}>Shipping &amp; Delivery</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-luxe-gray-dark">
            Standard delivery: <span className="text-luxe-black">{getDeliveryEstimate(3, 5)}</span>
          </p>
          <p className="mt-1 text-sm text-luxe-gray-dark">
            Express delivery: <span className="text-luxe-black">{getDeliveryEstimate(1, 2)}</span>
          </p>
          <p className="mt-3 text-sm text-luxe-gray-dark">
            Free standard shipping on orders over €150. Express shipping calculated at checkout.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="returns">
        <AccordionTrigger className={TRIGGER_CLASS}>{t("returns")}</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-luxe-gray-dark">
            Free returns within 30 days of delivery. Items must be unworn, unwashed, and with tags attached.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
