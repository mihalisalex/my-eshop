import { describe, expect, it } from "vitest";
import { breadcrumbSchema, faqSchema, productListSchema, productSchema } from "@/lib/seo";
import type { Product } from "@/types";

const SITE = "https://shopalexandris.vercel.app";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "loafer-black",
    name: "Μαύρο loafer",
    description: "Ένα δερμάτινο loafer.",
    price: { amount: 79.9, currencyCode: "EUR" },
    images: [
      { src: "https://cdn.example/a.jpg", alt: "a" },
      { src: "https://cdn.example/b.jpg", alt: "b" },
    ],
    colors: [],
    sizes: [],
    category: "loafers",
    categoryId: "c1",
    collectionIds: [],
    tags: [],
    gender: "women",
    materials: [],
    careInstructions: [],
    sku: "SKU-1",
    inventoryPolicy: "deny",
    availableForSale: true,
    status: "active",
    ...overrides,
  } as Product;
}

describe("productSchema", () => {
  it("never emits aggregateRating, however the product is shaped", () => {
    /**
     * The regression guard for the finding that removed it: `Product.rating` is a
     * denormalised leftover no review system writes, and the page shows no stars. Markup
     * asserting a rating a visitor cannot see is what Google issues manual actions for.
     */
    const withRating = productSchema(product({ rating: 4.8, reviewCount: 120 }), SITE);
    expect(JSON.stringify(withRating)).not.toContain("aggregateRating");
    expect(JSON.stringify(withRating)).not.toContain("4.8");
  });

  it("quotes the price a shopper actually pays, not the list price", () => {
    const onSale = productSchema(
      product({ price: { amount: 100, currencyCode: "EUR" }, salePrice: { amount: 60, currencyCode: "EUR" } }),
      SITE
    );
    // Emitting 100 while the page sells at 60 is a mismatch Merchant Center rejects.
    expect(onSale.offers.price).toBe(60);
    expect(productSchema(product(), SITE).offers.price).toBe(79.9);
  });

  it("omits brand and gtin entirely rather than emitting empty values", () => {
    const bare = productSchema(product(), SITE);
    expect(bare).not.toHaveProperty("brand");
    expect(bare).not.toHaveProperty("gtin");

    const full = productSchema(product({ brand: "U.S. Polo Assn.", barcode: "5201234567890" }), SITE);
    expect(full.brand).toEqual({ "@type": "Brand", name: "U.S. Polo Assn." });
    expect(full.gtin).toBe("5201234567890");
  });

  it("reports availability from the purchasability flag", () => {
    expect(productSchema(product(), SITE).offers.availability).toBe("https://schema.org/InStock");
    expect(productSchema(product({ availableForSale: false }), SITE).offers.availability).toBe(
      "https://schema.org/OutOfStock"
    );
  });

  it("builds an absolute offer URL from the site root", () => {
    expect(productSchema(product(), SITE).offers.url).toBe(`${SITE}/products/loafer-black`);
  });
});

describe("productListSchema", () => {
  it("numbers items from 1 and reports the real count", () => {
    const list = productListSchema(
      [
        { slug: "a", name: "A" },
        { slug: "b", name: "B" },
      ],
      SITE,
      "Loafers"
    );
    expect(list.numberOfItems).toBe(2);
    expect(list.itemListElement[0].position).toBe(1);
    expect(list.itemListElement[1].url).toBe(`${SITE}/products/b`);
  });

  it("carries only names and URLs, not prices", () => {
    // Repeating price and availability here would give them two places to disagree with
    // the product pages that state them authoritatively.
    const list = productListSchema([{ slug: "a", name: "A" }], SITE, "Loafers");
    expect(JSON.stringify(list)).not.toContain("price");
    expect(JSON.stringify(list)).not.toContain("availability");
  });
});

describe("breadcrumbSchema", () => {
  it("numbers the trail from 1 and makes every item absolute", () => {
    const crumbs = breadcrumbSchema(
      [
        { name: "Αρχική", href: "/" },
        { name: "Loafers", href: "/category/loafers" },
      ],
      SITE
    );
    expect(crumbs.itemListElement[0]).toMatchObject({ position: 1, name: "Αρχική", item: `${SITE}/` });
    expect(crumbs.itemListElement[1].item).toBe(`${SITE}/category/loafers`);
  });
});

describe("faqSchema", () => {
  it("pairs each question with its answer", () => {
    const faq = faqSchema([{ question: "Πότε παραδίδετε;", answer: "Σε 2-4 εργάσιμες." }]);
    expect(faq.mainEntity[0].name).toBe("Πότε παραδίδετε;");
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe("Σε 2-4 εργάσιμες.");
  });
});
