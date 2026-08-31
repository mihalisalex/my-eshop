import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  clampDescription,
  resolveCategorySeo,
  resolveCollectionSeo,
  resolveProductSeo,
  resolveStaticSeo,
} from "@/lib/seo/resolve";
import type { Category, Collection, Product, SiteSeoDefaults } from "@/types";

const seo: SiteSeoDefaults = {
  titleTemplate: "%s | ALEXANDRIS",
  defaultTitle: "ALEXANDRIS",
  defaultDescription: "Παπούτσια στο Ηράκλειο Κρήτης.",
  siteUrl: "https://shopalexandris.vercel.app",
  organization: { name: "ALEXANDRIS", logo: "/logo.svg", sameAs: [] },
};

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "loafer-black",
    name: "Μαύρο loafer",
    description: "Ένα δερμάτινο loafer.",
    price: { amount: 79.9, currencyCode: "EUR" },
    images: [{ src: "https://cdn.example/a.jpg", alt: "Μαύρο loafer" }],
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

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: "c1",
    slug: "loafers",
    name: "Loafers",
    position: 0,
    isFeatured: false,
    isVisible: true,
    ...overrides,
  } as Category;
}

describe("clampDescription", () => {
  it("leaves a short description alone", () => {
    expect(clampDescription("Short enough.")).toBe("Short enough.");
  });

  it("collapses whitespace so a multi-line description does not carry newlines into a meta tag", () => {
    expect(clampDescription("one\n\n  two   three")).toBe("one two three");
  });

  it("cuts at a word boundary rather than mid-word", () => {
    const out = clampDescription(`${"word ".repeat(60)}end`, 40);
    expect(out.length).toBeLessThanOrEqual(41);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/wor…$/);
  });
});

describe("absoluteUrl", () => {
  it("builds an absolute URL from a site-relative path", () => {
    expect(absoluteUrl("/products/x", seo.siteUrl)).toBe("https://shopalexandris.vercel.app/products/x");
  });
});

describe("resolveProductSeo", () => {
  it("generates title and description from the product when nothing is overridden", () => {
    const resolved = resolveProductSeo(product(), { seo });
    expect(resolved.title).toBe("Μαύρο loafer");
    expect(resolved.description).toBe("Ένα δερμάτινο loafer.");
    expect(resolved.canonical).toBe("https://shopalexandris.vercel.app/products/loafer-black");
    expect(resolved.noIndex).toBe(false);
  });

  it("prefers a manual override over the generated value", () => {
    const resolved = resolveProductSeo(product({ seo: { title: "Custom", description: "Custom desc" } }), { seo });
    expect(resolved.title).toBe("Custom");
    expect(resolved.description).toBe("Custom desc");
  });

  /**
   * The regression that motivated this module: a form with the SEO block left blank stores
   * "" rather than absent, and `??` would hand that empty string to the <title>.
   */
  it("treats an empty-string override as absent, not as an empty title", () => {
    const resolved = resolveProductSeo(product({ seo: { title: "", description: "  " } }), { seo });
    expect(resolved.title).toBe("Μαύρο loafer");
    expect(resolved.description).toBe("Ένα δερμάτινο loafer.");
  });

  it("honours a canonical override and a noindex flag", () => {
    const resolved = resolveProductSeo(
      product({ seo: { canonicalUrl: "https://example.gr/other", noIndex: true } }),
      { seo }
    );
    expect(resolved.canonical).toBe("https://example.gr/other");
    expect(resolved.noIndex).toBe(true);
  });

  it("falls og title and description back through the SEO title before the product name", () => {
    const withSeoTitle = resolveProductSeo(product({ seo: { title: "SEO title" } }), { seo });
    expect(withSeoTitle.ogTitle).toBe("SEO title");

    const withOgTitle = resolveProductSeo(product({ seo: { title: "SEO title", ogTitle: "Social" } }), { seo });
    expect(withOgTitle.ogTitle).toBe("Social");
  });

  it("includes the category in the breadcrumb trail when one is supplied", () => {
    const resolved = resolveProductSeo(product(), {
      seo,
      category: { name: "Loafers", slug: "loafers" },
      homeLabel: "Αρχική",
    });
    expect(resolved.breadcrumbs.map((b) => b.name)).toEqual(["Αρχική", "Loafers", "Μαύρο loafer"]);
    expect(resolved.breadcrumbs[1].href).toBe("/category/loafers");
  });

  it("omits the category crumb rather than emitting a broken link when there is no category", () => {
    const resolved = resolveProductSeo(product(), { seo });
    expect(resolved.breadcrumbs).toHaveLength(2);
  });
});

describe("resolveCategorySeo", () => {
  it("uses the site default description when the category has none of its own", () => {
    const resolved = resolveCategorySeo(category(), { seo });
    expect(resolved.description).toBe(seo.defaultDescription);
  });

  it("marks a hidden category noindex regardless of its override", () => {
    const resolved = resolveCategorySeo(category({ isVisible: false }), { seo });
    expect(resolved.noIndex).toBe(true);
  });

  it("builds the full ancestor trail so nesting is visible to a crawler", () => {
    const resolved = resolveCategorySeo(category({ name: "Running", slug: "running" }), {
      seo,
      ancestors: [{ name: "Sneakers", slug: "sneakers" } as Category],
      homeLabel: "Αρχική",
    });
    expect(resolved.breadcrumbs.map((b) => b.href)).toEqual(["/", "/category/sneakers", "/category/running"]);
  });

  it("carries editorial intro and FAQs through, and defaults FAQs to an empty list", () => {
    expect(resolveCategorySeo(category(), { seo }).faqs).toEqual([]);

    const withContent = resolveCategorySeo(
      category({ seo: { introContent: "  Intro copy.  ", faqs: [{ question: "Q", answer: "A" }] } }),
      { seo }
    );
    expect(withContent.introContent).toBe("Intro copy.");
    expect(withContent.faqs).toEqual([{ question: "Q", answer: "A" }]);
  });

  it("treats a blank intro as absent so the page renders no empty content block", () => {
    const resolved = resolveCategorySeo(category({ seo: { introContent: "   " } }), { seo });
    expect(resolved.introContent).toBeUndefined();
  });
});

describe("resolveCollectionSeo", () => {
  it("falls back through description, then subtitle, then the site default", () => {
    const base = { id: "x", slug: "edit", title: "The Edit", image: { src: "/i.jpg", alt: "i" } } as Collection;
    expect(resolveCollectionSeo({ ...base, description: "Desc" }, { seo }).description).toBe("Desc");
    expect(resolveCollectionSeo({ ...base, subtitle: "Sub" }, { seo }).description).toBe("Sub");
    expect(resolveCollectionSeo(base, { seo }).description).toBe(seo.defaultDescription);
  });

  it("self-canonicalises to the collection URL", () => {
    const resolved = resolveCollectionSeo({ id: "x", slug: "edit", title: "The Edit" } as Collection, { seo });
    expect(resolved.canonical).toBe("https://shopalexandris.vercel.app/collections/edit");
  });
});

describe("resolveStaticSeo", () => {
  it("does not repeat the home crumb on the home page itself", () => {
    const resolved = resolveStaticSeo({ path: "/", title: "Home", description: "d" }, { seo, homeLabel: "Αρχική" });
    expect(resolved.breadcrumbs).toEqual([{ name: "Αρχική", href: "/" }]);
  });

  it("builds a two-level trail for any other fixed route", () => {
    const resolved = resolveStaticSeo({ path: "/women", title: "Γυναικεία", description: "d" }, { seo });
    expect(resolved.breadcrumbs.map((b) => b.href)).toEqual(["/", "/women"]);
  });
});
