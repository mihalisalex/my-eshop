import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/admin-session";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isOwnBlobUrl, renameImageInBlob } from "@/lib/blob";
import { getMediaUsage, renameMediaAsset } from "@/services/media";

/**
 * Renames a photo's stored file to match the alt text it was just given, when it is
 * assigned to a product — the product form's own "SEO reason" for this route.
 *
 * Always best-effort: this returns `{ url }` (the ORIGINAL url, unchanged) rather than an
 * error status for every case where renaming isn't safe or doesn't apply, so a caller can
 * always trust the response and never has to treat "not renamed" as a failure that should
 * block attaching the photo to the product.
 */
export async function POST(request: Request) {
  try {
    await requireCapability("content:media");

    // Fires once per photo assignment, so the same generous per-admin ceiling the upload
    // route uses is the right shape here too.
    const limited = await enforceRateLimit(request, { name: "media-rename", limit: 200, windowMs: 10 * 60 * 1000 });
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    const url = typeof body?.url === "string" ? body.url : "";
    const filename = typeof body?.filename === "string" ? body.filename.trim() : "";
    if (!url) return invalidInputResponse("A photo URL is required.");

    // Nothing to rename TO yet — the product has no slug, SKU or colour on it. Not an
    // error: this is the ordinary case for a photo dropped in before those are filled in.
    if (!filename) return NextResponse.json({ url });

    // Never touch a URL this store doesn't own the storage for — the WooCommerce import's
    // original host and Instagram's CDN are allow-listed for DISPLAY only.
    if (!isOwnBlobUrl(url)) return NextResponse.json({ url });

    /**
     * Skip anything already used elsewhere in the catalogue. A freshly uploaded photo has
     * no usages yet and renames freely; a photo picked back out of the Media Library may
     * already be attached to a DIFFERENT product (a shared packaging shot, a colourway),
     * and renaming its file would break every other place still pointing at the old URL.
     * Being over-cautious here — skipping a rename that would actually have been fine —
     * fails in the safe direction; getMediaUsage already documents the same principle.
     */
    const usage = await getMediaUsage(url);
    if (usage.length > 0) return NextResponse.json({ url });

    const extension = new URL(url).pathname.split(".").pop()?.split(/[?#]/)[0] || "jpg";
    // `filename` is already the slugify()'d alt-text identifier — a-z0-9 and hyphens only —
    // but the extension is trusted even less: taken from the CURRENT blob's own pathname,
    // never from client input.
    const targetPathname = `products/${filename.replace(/[^a-z0-9-]/g, "-")}.${extension.replace(/[^a-z0-9]/g, "") || "jpg"}`;

    const result = await renameImageInBlob(url, targetPathname);
    if ("error" in result) return NextResponse.json({ url });

    await renameMediaAsset(url, { url: result.url, pathname: targetPathname, filename: `${filename}.${extension}` });

    return NextResponse.json({ url: result.url });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
