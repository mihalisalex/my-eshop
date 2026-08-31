import "server-only";
import { prisma } from "@/lib/prisma";
import { productInclude, toProduct, categoryInclude, toCategory, collectionInclude, toCollection } from "@/lib/commerce/postgres/mappers";
import { auditPages, type AuditablePage, type SeoAuditResult } from "@/lib/seo/audit-rules";
import { resolveCategorySeo, resolveCollectionSeo, resolveProductSeo } from "@/lib/seo/resolve";
import { getSeoDefaults } from "@/services/seo";
import { ROUTES } from "@/constants/routes";

/**
 * Assembles every indexable page into the flat shape the audit rules judge, then runs them.
 *
 * The pages are described through the SAME resolver the storefront renders with, so the
 * audit reports on what actually ships rather than on the raw columns. A product whose
 * title comes from its name and a product whose title comes from an override are both just
 * "a page with this title" here — which is the only way the duplicate-title check can be
 * correct, since two products can collide through their fallbacks without either having an
 * override at all.
 */

/**
 * Alt text that exists but says nothing.
 *
 * A photograph captioned with the product name repeats what the heading beside it already
 * says, which helps neither a screen reader nor image search. Treated as weak rather than
 * missing so the count stays honest about which it is.
 */
function isWeakAlt(alt: string | undefined, productName: string): boolean {
  const trimmed = alt?.trim() ?? "";
  if (!trimmed) return true;
  const normalise = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
  return normalise(trimmed) === normalise(productName);
}

export async function runSeoAudit(): Promise<SeoAuditResult> {
  const seo = await getSeoDefaults();

  /**
   * Only published products, visible categories and every collection — the same set the
   * sitemap offers to Google. Auditing drafts would fill the report with work nobody has
   * finished yet, which is not a finding.
   */
  const [productRows, categoryRows, collectionRows] = await Promise.all([
    prisma.product.findMany({ where: { status: "active" }, include: productInclude }),
    prisma.category.findMany({ where: { isVisible: true }, include: categoryInclude }),
    prisma.collection.findMany({ include: collectionInclude }),
  ]);

  const pages: AuditablePage[] = [];

  for (const row of productRows) {
    const product = toProduct(row);
    const resolved = resolveProductSeo(product, { seo });
    pages.push({
      type: "product",
      id: product.id,
      name: product.name,
      path: ROUTES.product(product.slug),
      editPath: `/admin/products/${product.id}`,
      title: resolved.title,
      description: resolved.description,
      hasTitleOverride: Boolean(product.seo?.title?.trim()),
      hasDescriptionOverride: Boolean(product.seo?.description?.trim()),
      noIndex: resolved.noIndex,
      contentLength: product.description.trim().length,
      imageCount: product.images.length,
      weakAltCount: product.images.filter((image) => isWeakAlt(image.alt, product.name)).length,
      brand: product.brand,
      barcode: product.barcode,
      // The badge and the price disagreeing is visible to Google through the Offer.
      saleFlagWithoutSalePrice: Boolean(product.isSale) && !product.salePrice,
    });
  }

  for (const row of categoryRows) {
    const category = toCategory(row);
    const resolved = resolveCategorySeo(category, { seo });
    pages.push({
      type: "category",
      id: category.id,
      name: category.name,
      path: ROUTES.category(category.slug),
      editPath: `/admin/categories/${category.id}`,
      title: resolved.title,
      description: resolved.description,
      hasTitleOverride: Boolean(category.seo?.title?.trim()),
      hasDescriptionOverride: Boolean(category.seo?.description?.trim()),
      noIndex: resolved.noIndex,
      contentLength: (resolved.introContent ?? "").trim().length,
      imageCount: [category.image, category.bannerImage].filter(Boolean).length,
      weakAltCount: [category.image, category.bannerImage].filter(
        (image) => image && !image.alt?.trim()
      ).length,
      productCount: category.productCount ?? 0,
    });
  }

  for (const row of collectionRows) {
    const collection = toCollection(row);
    const resolved = resolveCollectionSeo(collection, { seo });
    pages.push({
      type: "collection",
      id: collection.id,
      name: collection.title,
      path: ROUTES.collection(collection.slug),
      editPath: `/admin/collections/${collection.id}`,
      title: resolved.title,
      description: resolved.description,
      hasTitleOverride: Boolean(collection.seo?.title?.trim()),
      hasDescriptionOverride: Boolean(collection.seo?.description?.trim()),
      noIndex: resolved.noIndex,
      contentLength: (resolved.introContent ?? "").trim().length,
      imageCount: collection.image?.src ? 1 : 0,
      weakAltCount: collection.image?.src && !collection.image.alt?.trim() ? 1 : 0,
      productCount: collection.productIds?.length ?? 0,
    });
  }

  return auditPages(pages, seo.titleTemplate);
}
