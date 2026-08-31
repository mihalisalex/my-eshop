import { DESCRIPTION_LENGTH_LIMIT, TITLE_LENGTH_LIMIT, applyTitleTemplate } from "@/lib/seo/resolve";

/**
 * The SEO audit, as pure functions over a flat description of every indexable page.
 *
 * Deliberately NOT a crawler. A crawler would fetch this site's own pages over HTTP to
 * re-derive facts the database already holds — slower, flakier, and wrong the moment a
 * request fails for an unrelated reason. Everything checked here is knowable from the
 * catalogue itself, which also means the audit runs in a second rather than a quarter of an
 * hour and cannot be defeated by a cold start.
 *
 * The two things a crawler WOULD catch and this cannot are rendering failures and broken
 * outbound links. Those belong to a different tool, and pretending otherwise by shipping a
 * half-crawler that only visits URLs it already knows about would be the worse trade.
 *
 * Being pure is what makes it testable: `audit-rules.test.ts` asserts every rule against
 * constructed inputs, with no database and no network.
 */

export type SeoIssueSeverity = "critical" | "high" | "medium" | "low";

export type SeoEntityType = "product" | "category" | "collection";

/** One page, flattened to only what the rules below need to judge it. */
export interface AuditablePage {
  type: SeoEntityType;
  id: string;
  name: string;
  /** Site-relative, for linking the admin straight to the storefront page. */
  path: string;
  /** Where an admin goes to FIX it. */
  editPath: string;
  /** Resolved title and description — what will actually ship, overrides applied. */
  title: string;
  description: string;
  /** Whether the value is the admin's or the generated fallback. */
  hasTitleOverride: boolean;
  hasDescriptionOverride: boolean;
  noIndex: boolean;
  /** Body copy length, for thinness. Product description, category intro, etc. */
  contentLength: number;
  imageCount: number;
  /** Images whose alt text is missing or is just a copy of the product name. */
  weakAltCount: number;
  /** Products in a category/collection. Undefined for products themselves. */
  productCount?: number;
  /** Product-only signals, used by the structured-data rules. */
  brand?: string;
  barcode?: string;
  /** `isSale` badge set but no sale price — the badge and the price disagree. */
  saleFlagWithoutSalePrice?: boolean;
}

export interface SeoIssue {
  /** Stable across runs so the UI can group and the owner can recognise a repeat. */
  rule: string;
  severity: SeoIssueSeverity;
  title: string;
  /** Why it matters, in the shop owner's terms rather than an SEO acronym. */
  detail: string;
  page: Pick<AuditablePage, "type" | "id" | "name" | "path" | "editPath">;
}

export interface SeoAuditResult {
  issues: SeoIssue[];
  /** 0-100. See scoreFromIssues for what it does and does not mean. */
  score: number;
  pagesAudited: number;
  countsBySeverity: Record<SeoIssueSeverity, number>;
}

const SEVERITY_ORDER: SeoIssueSeverity[] = ["critical", "high", "medium", "low"];

/** Below this, a description is too short to say anything a SERP can use. */
const MIN_DESCRIPTION_LENGTH = 70;
/** Below this, a product description is boilerplate rather than content. */
const THIN_CONTENT_LENGTH = 120;
/** A category with fewer products than this is a thin page competing with its own parent. */
const THIN_CATEGORY_PRODUCTS = 3;

function issue(
  page: AuditablePage,
  rule: string,
  severity: SeoIssueSeverity,
  title: string,
  detail: string
): SeoIssue {
  return {
    rule,
    severity,
    title,
    detail,
    page: { type: page.type, id: page.id, name: page.name, path: page.path, editPath: page.editPath },
  };
}

/** Normalised for duplicate detection — case and spacing are not meaningful differences. */
function fingerprint(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Per-page rules. Everything that can be judged without looking at the rest of the site.
 */
function auditPage(page: AuditablePage): SeoIssue[] {
  const found: SeoIssue[] = [];

  /**
   * A noindex page is excluded from almost everything else deliberately. It is not in
   * search, so a short description on it is not a problem — reporting one would bury the
   * pages that ARE competing under noise about pages that are not.
   */
  if (page.noIndex) {
    return found;
  }

  if (!page.title.trim()) {
    found.push(
      issue(page, "title-missing", "critical", "No title", "This page has nothing to show as its headline in search results.")
    );
  } else if (page.title.trim().length > TITLE_LENGTH_LIMIT) {
    /**
     * Only the page's OWN title is judged here. A title that fits and is then pushed over
     * the limit by the site template is not this page's problem — it is one setting, and
     * `auditTitleTemplate` reports it once instead of on every page in the catalogue.
     */
    found.push(
      issue(
        page,
        "title-too-long",
        "medium",
        "Title too long",
        `${page.title.trim().length} characters before the shop name is even appended. Google shows about ${TITLE_LENGTH_LIMIT}.`
      )
    );
  }

  if (!page.description.trim()) {
    found.push(
      issue(
        page,
        "description-missing",
        "high",
        "No description",
        "Google will invent one from the page text, which is rarely the sentence you would have chosen."
      )
    );
  } else if (page.description.trim().length < MIN_DESCRIPTION_LENGTH) {
    found.push(
      issue(
        page,
        "description-short",
        "low",
        "Very short description",
        `${page.description.trim().length} characters. There is room for about ${DESCRIPTION_LENGTH_LIMIT}, and the space is free.`
      )
    );
  }

  if (page.imageCount === 0) {
    found.push(
      issue(
        page,
        "image-missing",
        page.type === "product" ? "critical" : "medium",
        "No image",
        page.type === "product"
          ? "A product with no photograph will not sell and cannot appear in image search."
          : "This page has no image to show in menus, social shares, or search."
      )
    );
  }

  if (page.weakAltCount > 0) {
    found.push(
      issue(
        page,
        "alt-text-weak",
        "medium",
        `${page.weakAltCount} image${page.weakAltCount === 1 ? "" : "s"} without useful alt text`,
        "Alt text is what a screen reader announces and what Google reads for image search. Describe the photograph, do not repeat the product name."
      )
    );
  }

  if (page.type === "product") {
    if (page.contentLength < THIN_CONTENT_LENGTH) {
      found.push(
        issue(
          page,
          "content-thin",
          "high",
          "Very little description",
          `${page.contentLength} characters. There is nothing here for a search engine to match a question against.`
        )
      );
    }
    if (!page.brand) {
      found.push(
        issue(
          page,
          "brand-missing",
          "medium",
          "No brand set",
          "Brand is part of the product data Google reads, and brand-plus-product is how most people search for shoes."
        )
      );
    }
    if (!page.barcode) {
      found.push(
        issue(
          page,
          "gtin-missing",
          "low",
          "No barcode",
          "A GTIN lets Google match this to the same product elsewhere. Optional, but it is what own-label products can never have and branded ones usually do."
        )
      );
    }
    if (page.saleFlagWithoutSalePrice) {
      found.push(
        issue(
          page,
          "sale-flag-inconsistent",
          "high",
          "Marked on sale with no sale price",
          "The badge says reduced and the price says otherwise. Structured data carries the price, so this is a contradiction Google can see."
        )
      );
    }
  }

  if (page.type !== "product" && page.productCount !== undefined) {
    if (page.productCount === 0) {
      found.push(
        issue(
          page,
          "listing-empty",
          "high",
          "No products",
          "An empty listing page is one Google will either ignore or index as a dead end. Fill it, hide it, or remove it."
        )
      );
    } else if (page.productCount < THIN_CATEGORY_PRODUCTS) {
      found.push(
        issue(
          page,
          "listing-thin",
          "medium",
          `Only ${page.productCount} product${page.productCount === 1 ? "" : "s"}`,
          "Too few to be worth its own page. It competes with its parent category for the same searches and usually loses."
        )
      );
    }

    if (!page.contentLength) {
      found.push(
        issue(
          page,
          "listing-no-intro",
          "low",
          "No introduction",
          "A grid of products and nothing else gives Google no text to rank. A few honest sentences is what separates a category page from a filter."
        )
      );
    }
  }

  return found;
}

/**
 * Cross-page rules — the ones that can only be seen by comparing pages to each other.
 *
 * Duplicates are reported on every page in the set rather than on all-but-one. There is no
 * basis for calling one of them the original, and the fix requires visiting each anyway.
 */
function auditDuplicates(pages: AuditablePage[]): SeoIssue[] {
  const found: SeoIssue[] = [];
  const indexable = pages.filter((page) => !page.noIndex);

  const byTitle = new Map<string, AuditablePage[]>();
  const byDescription = new Map<string, AuditablePage[]>();

  for (const page of indexable) {
    if (page.title.trim()) {
      const key = fingerprint(page.title);
      byTitle.set(key, [...(byTitle.get(key) ?? []), page]);
    }
    if (page.description.trim()) {
      const key = fingerprint(page.description);
      byDescription.set(key, [...(byDescription.get(key) ?? []), page]);
    }
  }

  for (const [, group] of byTitle) {
    if (group.length < 2) continue;
    for (const page of group) {
      found.push(
        issue(
          page,
          "title-duplicate",
          "high",
          `Title shared with ${group.length - 1} other page${group.length === 2 ? "" : "s"}`,
          "Identical titles make pages look interchangeable, and Google will pick one and drop the rest."
        )
      );
    }
  }

  for (const [, group] of byDescription) {
    if (group.length < 2) continue;
    // A shared description is only worth reporting when it was WRITTEN that way. Several
    // pages falling back to the site default is a different problem, already reported as
    // "no description" on each of them, and repeating it here would double the noise.
    const authored = group.filter((page) => page.hasDescriptionOverride);
    if (authored.length < 2) continue;
    for (const page of authored) {
      found.push(
        issue(
          page,
          "description-duplicate",
          "medium",
          `Description shared with ${authored.length - 1} other page${authored.length === 2 ? "" : "s"}`,
          "The same sentence under several results gives a searcher no reason to choose one."
        )
      );
    }
  }

  return found;
}

/**
 * One setting, reported once.
 *
 * The site's title template is appended to every page title. When it is long enough to push
 * otherwise-fine titles past what a SERP shows, that is a single fact about one field in
 * SEO Settings — not a fault of each of 176 products.
 *
 * The first version of this rule measured the templated length per page and duly reported
 * it 176 times out of 184, burying every other finding under one setting. Running the audit
 * against the real catalogue is what surfaced that; it is the difference between a report
 * an owner acts on and a report they close.
 */
function auditTitleTemplate(pages: AuditablePage[], titleTemplate: string): SeoIssue[] {
  const indexable = pages.filter((page) => !page.noIndex && page.title.trim());
  if (indexable.length === 0) return [];

  const pushedOver = indexable.filter((page) => {
    const raw = page.title.trim();
    return raw.length <= TITLE_LENGTH_LIMIT && applyTitleTemplate(raw, titleTemplate).length > TITLE_LENGTH_LIMIT;
  });

  // A quarter of the catalogue is the point at which this stops being a few long titles and
  // starts being the template.
  if (pushedOver.length < indexable.length * 0.25) return [];

  const overhead = applyTitleTemplate("", titleTemplate).length;
  return [
    {
      rule: "title-template-too-long",
      severity: "high",
      title: "The site title template is too long",
      detail:
        `It adds ${overhead} characters to every page title, which pushes ${pushedOver.length} of ${indexable.length} pages past the ~${TITLE_LENGTH_LIMIT} characters Google shows. ` +
        `Shortening it in SEO Settings fixes all of them at once — no page needs editing.`,
      page: {
        type: "category",
        id: "site",
        name: "SEO Settings",
        path: "/",
        editPath: "/admin/seo",
      },
    },
  ];
}

/**
 * A single number for "how is the catalogue doing".
 *
 * Measured as the SHARE OF PAGES carrying a problem at each severity, not as a total count
 * of problems. Counting totals pins any real catalogue at zero — 184 pages with a few
 * common gaps produced 849 issues and a score of 0, which tells an owner nothing and cannot
 * improve visibly when they fix fifty of them.
 *
 * It is a progress bar, not a measurement. Nothing external is observed, so it reports only
 * on what this shop has filled in: a shop can score 100 here and rank for nothing. It is
 * useful for the direction it moves in, and that is all it is offered as.
 */
export function scoreFromIssues(issues: SeoIssue[], pagesAudited: number): number {
  if (pagesAudited === 0) return 100;

  const pagesWith: Record<SeoIssueSeverity, Set<string>> = {
    critical: new Set(),
    high: new Set(),
    medium: new Set(),
    low: new Set(),
  };
  for (const found of issues) pagesWith[found.severity].add(found.page.id);

  const weights: Record<SeoIssueSeverity, number> = { critical: 45, high: 30, medium: 15, low: 5 };
  const penalty = SEVERITY_ORDER.reduce(
    (sum, severity) => sum + (pagesWith[severity].size / pagesAudited) * weights[severity],
    0
  );

  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export function auditPages(pages: AuditablePage[], titleTemplate: string): SeoAuditResult {
  const issues = [
    ...auditTitleTemplate(pages, titleTemplate),
    ...pages.flatMap((page) => auditPage(page)),
    ...auditDuplicates(pages),
  ].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));

  const countsBySeverity: Record<SeoIssueSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const found of issues) countsBySeverity[found.severity] += 1;

  return {
    issues,
    score: scoreFromIssues(issues, pages.length),
    pagesAudited: pages.length,
    countsBySeverity,
  };
}
