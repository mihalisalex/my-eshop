import { NextResponse, type NextRequest } from "next/server";
import { getAllCollections, getCollectionBySlug, getCollectionsByIds } from "@/services/collections";

/** Same rationale as app/api/products/route.ts — a browser-safe facade over the Prisma-backed collection data. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const slug = searchParams.get("slug");
  if (slug) {
    const collection = await getCollectionBySlug(slug);
    return NextResponse.json({ collections: collection ? [collection] : [] });
  }

  const ids = searchParams.get("ids");
  if (ids) {
    const collections = await getCollectionsByIds(ids.split(",").filter(Boolean));
    return NextResponse.json({ collections });
  }

  const collections = await getAllCollections();
  return NextResponse.json({ collections });
}
