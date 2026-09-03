import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/admin-session";
import { commerceErrorResponse } from "@/lib/commerce/http-errors";
import { listMediaForAdmin } from "@/services/media";

/**
 * Read access for the Media Library, for the product form's picker modal.
 *
 * Every other admin data fetch runs inside a Server Component, which the picker cannot be —
 * it opens from a click, after the page has already rendered. This is the one place that
 * needs a GET route rather than a page. Reuses `listMediaForAdmin`, the same query the
 * library page itself calls, so what the picker shows is exactly what the library shows.
 */
export async function GET(request: Request) {
  try {
    await requireCapability("content:media");

    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1") || 1;
    const search = url.searchParams.get("q")?.trim() || undefined;
    const folder = url.searchParams.get("folder")?.trim() || undefined;

    const result = await listMediaForAdmin({ page, pageSize: 24, search, folder, usage: "all" });
    return NextResponse.json(result);
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
