import { describe, expect, it } from "vitest";
import { auditPages, scoreFromIssues, type AuditablePage } from "@/lib/seo/audit-rules";

const TEMPLATE = "%s | Alexandris Stores";

/** A page with nothing wrong with it, so each test can break exactly one thing. */
function page(overrides: Partial<AuditablePage> = {}): AuditablePage {
  return {
    type: "product",
    id: "p1",
    name: "Μαύρο loafer",
    path: "/products/loafer",
    editPath: "/admin/products/p1",
    title: "Μαύρο loafer",
    description: "Ένα δερμάτινο loafer φτιαγμένο για καθημερινή χρήση, με σόλα από φυσικό καουτσούκ.",
    hasTitleOverride: false,
    hasDescriptionOverride: false,
    noIndex: false,
    contentLength: 400,
    imageCount: 3,
    weakAltCount: 0,
    brand: "Alexandris Shoes",
    barcode: "5201234567890",
    saleFlagWithoutSalePrice: false,
    ...overrides,
  };
}

function rules(pages: AuditablePage[]): string[] {
  return auditPages(pages, TEMPLATE).issues.map((issue) => issue.rule);
}

describe("per-page rules", () => {
  it("reports nothing for a complete page", () => {
    expect(rules([page()])).toEqual([]);
  });

  it("flags a missing title as critical and a missing description as high", () => {
    const result = auditPages([page({ title: "", description: "" })], TEMPLATE);
    expect(result.issues.find((i) => i.rule === "title-missing")?.severity).toBe("critical");
    expect(result.issues.find((i) => i.rule === "description-missing")?.severity).toBe("high");
  });

  it("flags a title that is too long on its own merits", () => {
    expect(rules([page({ title: "A".repeat(80) })])).toContain("title-too-long");
    expect(rules([page({ title: "A".repeat(20) })])).not.toContain("title-too-long");
  });

  it("blames the template rather than the page when the template is what pushed it over", () => {
    // 45 characters is comfortably short on its own and only fails once the shop name is
    // appended. Reporting that per page buried everything else under one setting.
    const title = "A".repeat(45);
    const found = rules([page({ title })]);
    expect(found).not.toContain("title-too-long");
    expect(found).toContain("title-template-too-long");
  });

  it("reports the template once for the whole catalogue, not once per page", () => {
    const pages = Array.from({ length: 40 }, (_, i) => page({ id: `p${i}`, title: `${"A".repeat(44)}${i}` }));
    const found = auditPages(pages, TEMPLATE).issues.filter((i) => i.rule === "title-template-too-long");
    expect(found).toHaveLength(1);
    expect(found[0].page.editPath).toBe("/admin/seo");
  });

  it("stays quiet about the template when only a few titles are long", () => {
    const pages = [
      ...Array.from({ length: 20 }, (_, i) => page({ id: `ok${i}`, title: `Short ${i}` })),
      page({ id: "long", title: "A".repeat(45) }),
    ];
    expect(auditPages(pages, TEMPLATE).issues.map((i) => i.rule)).not.toContain("title-template-too-long");
  });

  it("says nothing at all about a noindex page", () => {
    // It is not competing in search, so its short description is not a finding — and
    // reporting it would bury the pages that ARE competing.
    expect(rules([page({ noIndex: true, title: "", description: "", imageCount: 0 })])).toEqual([]);
  });

  it("treats a product with no image as critical and a category with none as medium", () => {
    const product = auditPages([page({ imageCount: 0 })], TEMPLATE);
    expect(product.issues.find((i) => i.rule === "image-missing")?.severity).toBe("critical");

    const category = auditPages(
      [page({ type: "category", imageCount: 0, productCount: 10, contentLength: 200 })],
      TEMPLATE
    );
    expect(category.issues.find((i) => i.rule === "image-missing")?.severity).toBe("medium");
  });

  it("counts weak alt text", () => {
    expect(rules([page({ weakAltCount: 2 })])).toContain("alt-text-weak");
  });

  it("flags a thin product description, a missing brand and a missing barcode", () => {
    const found = rules([page({ contentLength: 20, brand: undefined, barcode: undefined })]);
    expect(found).toContain("content-thin");
    expect(found).toContain("brand-missing");
    expect(found).toContain("gtin-missing");
  });

  it("flags a sale badge with no sale price, because the markup carries the contradiction", () => {
    expect(rules([page({ saleFlagWithoutSalePrice: true })])).toContain("sale-flag-inconsistent");
  });

  it("does not apply product-only rules to categories", () => {
    const found = rules([page({ type: "category", productCount: 10, contentLength: 200, brand: undefined, barcode: undefined })]);
    expect(found).not.toContain("brand-missing");
    expect(found).not.toContain("gtin-missing");
    expect(found).not.toContain("content-thin");
  });

  it("flags empty and thin listings, and a listing with no introduction", () => {
    expect(rules([page({ type: "category", productCount: 0, contentLength: 200 })])).toContain("listing-empty");
    expect(rules([page({ type: "category", productCount: 2, contentLength: 200 })])).toContain("listing-thin");
    expect(rules([page({ type: "category", productCount: 10, contentLength: 0 })])).toContain("listing-no-intro");
  });
});

describe("duplicate detection", () => {
  it("reports a shared title on every page that shares it", () => {
    const found = auditPages(
      [page({ id: "a", title: "Loafer" }), page({ id: "b", title: "loafer  " })],
      TEMPLATE
    ).issues.filter((issue) => issue.rule === "title-duplicate");
    // Normalised for case and whitespace — those are not meaningful differences.
    expect(found).toHaveLength(2);
  });

  it("ignores shared descriptions that nobody authored", () => {
    // Several pages falling back to the site default is already reported as "no
    // description" on each; repeating it as a duplicate would double the noise.
    const shared = "The same generated fallback sentence used across the whole shop, at length.";
    const found = rules([
      page({ id: "a", description: shared, hasDescriptionOverride: false }),
      page({ id: "b", description: shared, hasDescriptionOverride: false }),
    ]);
    expect(found).not.toContain("description-duplicate");
  });

  it("reports shared descriptions that were written that way", () => {
    const shared = "A hand-written sentence that somebody pasted onto two different pages, at length.";
    const found = rules([
      page({ id: "a", description: shared, hasDescriptionOverride: true }),
      page({ id: "b", description: shared, hasDescriptionOverride: true }),
    ]);
    expect(found).toContain("description-duplicate");
  });

  it("excludes noindex pages from duplicate comparison", () => {
    const found = rules([page({ id: "a", title: "Loafer" }), page({ id: "b", title: "Loafer", noIndex: true })]);
    expect(found).not.toContain("title-duplicate");
  });
});

describe("scoreFromIssues", () => {
  it("is 100 with nothing to audit and nothing wrong", () => {
    expect(scoreFromIssues([], 0)).toBe(100);
    expect(scoreFromIssues([], 50)).toBe(100);
  });

  it("falls as severity rises, and never below zero", () => {
    const critical = auditPages([page({ title: "", description: "", imageCount: 0, contentLength: 0 })], TEMPLATE);
    expect(critical.score).toBeLessThan(100);
    expect(critical.score).toBeGreaterThanOrEqual(0);
  });

  it("does not collapse just because a large catalogue shares one low-severity gap", () => {
    // 100 products each missing only a barcode should stay a good score — the rule is
    // "low" for a reason, and a score that tanks on it would be useless.
    //
    // Titles and descriptions are varied per page so the duplicate rules stay silent and
    // this measures only what it means to measure.
    const pages = Array.from({ length: 100 }, (_, i) =>
      page({
        id: `p${i}`,
        title: `Loafer ${i}`,
        description: `A distinct description for product number ${i}, long enough to pass the minimum length check.`,
        barcode: undefined,
      })
    );
    expect(auditPages(pages, TEMPLATE).score).toBeGreaterThan(85);
  });

  it("does fall hard when a whole catalogue shares one title, because that is catastrophic", () => {
    // The inverse of the case above, and the reason the score weights severity: 100 pages
    // competing under one title is not a small problem.
    const pages = Array.from({ length: 100 }, (_, i) => page({ id: `p${i}`, title: "Shoe" }));
    expect(auditPages(pages, TEMPLATE).score).toBeLessThan(75);
  });

  it("scores by share of pages affected, so fixing some of them moves the number", () => {
    // Counting total issues pinned any real catalogue at 0 and could not improve visibly.
    const clean = (i: number) =>
      page({ id: `p${i}`, title: `Loafer ${i}`, description: `A distinct description for product ${i}, long enough to pass.` });
    const broken = (i: number) => ({ ...clean(i), contentLength: 10 });

    const allBroken = auditPages(Array.from({ length: 100 }, (_, i) => broken(i)), TEMPLATE).score;
    const halfBroken = auditPages(
      Array.from({ length: 100 }, (_, i) => (i < 50 ? broken(i) : clean(i))),
      TEMPLATE
    ).score;

    expect(halfBroken).toBeGreaterThan(allBroken);
  });

  it("sorts issues most severe first", () => {
    const result = auditPages([page({ title: "", barcode: undefined })], TEMPLATE);
    expect(result.issues[0].severity).toBe("critical");
  });
});
