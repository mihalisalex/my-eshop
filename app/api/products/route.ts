import { NextResponse, type NextRequest } from "next/server";
import {
  getAllProducts,
  getProductBySlug,
  getProductsByIds,
  getRelatedProducts,
} from "@/services/products";

/**
 * Thin HTTP facade over the (Prisma-backed) product data-access layer, for
 * client components that can't import it directly — Prisma Client cannot run
 * in the browser at all. Server Components/Server Actions should keep calling
 * `@/services/products` in-process; this route exists only for the browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const slug = searchParams.get("slug");
  if (slug) {
    const product = await getProductBySlug(slug);
    return NextResponse.json({ products: product ? [product] : [] });
  }

  const ids = searchParams.get("ids");
  if (ids) {
    const products = await getProductsByIds(ids.split(",").filter(Boolean));
    return NextResponse.json({ products });
  }

  const relatedTo = searchParams.get("relatedTo");
  if (relatedTo) {
    const limit = Number(searchParams.get("limit") ?? "4");
    const products = await getRelatedProducts(relatedTo, limit);
    return NextResponse.json({ products });
  }

  let products = await getAllProducts();
  const category = searchParams.get("category");
  const gender = searchParams.get("gender");
  const collectionId = searchParams.get("collectionId");
  const tag = searchParams.get("tag");
  if (category) products = products.filter((p) => p.category === category);
  if (gender) products = products.filter((p) => p.gender === gender);
  if (collectionId) products = products.filter((p) => p.collectionIds.includes(collectionId));
  if (tag) products = products.filter((p) => p.tags.includes(tag));

  return NextResponse.json({ products });
}
