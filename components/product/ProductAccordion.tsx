import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getDeliveryEstimate } from "@/lib/delivery";
import type { Product } from "@/types";

interface ProductAccordionProps {
  product: Product;
}

const FIT_NOTES: Record<Product["gender"], string> = {
  women: "Model is 178cm / 5'10\" wearing size S. Fits true to size.",
  men: "Model is 186cm / 6'1\" wearing size M. Fits true to size.",
  unisex: "Designed for a relaxed, true-to-size fit across genders.",
  kids: "Fits true to age size. Consider sizing up for growing room.",
};

export function ProductAccordion({ product }: ProductAccordionProps) {
  return (
    <Accordion className="border-t border-border">
      <AccordionItem value="fit">
        <AccordionTrigger className="py-4 text-sm font-medium tracking-[0.05em] uppercase no-underline hover:no-underline">
          Fit &amp; Composition
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-luxe-gray-dark">{FIT_NOTES[product.gender]}</p>
          <p className="mt-3 text-xs font-medium tracking-[0.05em] uppercase">Materials</p>
          <ul className="mt-1 list-inside list-disc text-sm text-luxe-gray-dark">
            {product.materials.map((material) => (
              <li key={material}>{material}</li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="care">
        <AccordionTrigger className="py-4 text-sm font-medium tracking-[0.05em] uppercase no-underline hover:no-underline">
          Care Instructions
        </AccordionTrigger>
        <AccordionContent>
          <ul className="list-inside list-disc text-sm text-luxe-gray-dark">
            {product.careInstructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="shipping">
        <AccordionTrigger className="py-4 text-sm font-medium tracking-[0.05em] uppercase no-underline hover:no-underline">
          Shipping &amp; Delivery
        </AccordionTrigger>
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
        <AccordionTrigger className="py-4 text-sm font-medium tracking-[0.05em] uppercase no-underline hover:no-underline">
          Returns
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-luxe-gray-dark">
            Free returns within 30 days of delivery. Items must be unworn, unwashed, and with tags attached.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
