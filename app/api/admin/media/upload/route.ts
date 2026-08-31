import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/admin-session";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { UploadRejectedError, uploadImageToBlob } from "@/lib/blob";
import { createMediaAsset } from "@/services/media";

/**
 * Uploading now also records a MediaAsset. Previously this returned a bare URL and wrote
 * nothing, so an uploaded file was invisible in the Media Library until someone happened to
 * attach it to a product — the library only ever listed images already referenced
 * elsewhere. Recording the asset is what makes upload-then-attach possible.
 */
export async function POST(request: Request) {
  try {
    await requireCapability("content:media");

    // Generous, because a bulk drop into the Media Library is one request per file and a
    // CSV import resolves images row by row. It bounds a runaway client or a compromised
    // editor account rather than getting in an admin's way.
    const limited = await enforceRateLimit(request, { name: "media-upload", limit: 200, windowMs: 10 * 60 * 1000 });
    if (limited) return limited;

    const form = await request.formData();
    const files = form.getAll("file").filter((value): value is File => value instanceof File);
    if (files.length === 0) return invalidInputResponse("No files were provided.");

    const folderValue = form.get("folder");
    const folder = typeof folderValue === "string" && folderValue.trim() !== "" ? folderValue.trim() : undefined;

    /**
     * Dimensions are measured in the browser and sent alongside, rather than decoded here.
     * Reading them server-side would mean taking `sharp` on as a direct dependency (it's
     * only present transitively, via Next) to obtain what is purely display metadata.
     * Client-supplied values are fine for that: the worst case is a wrong number shown in
     * the library, and they're parsed defensively rather than trusted as-is.
     */
    const dimensionsFor = (filename: string): { width?: number; height?: number } => {
      const raw = form.get(`dimensions:${filename}`);
      if (typeof raw !== "string") return {};
      const [w, h] = raw.split("x").map((n) => Number.parseInt(n, 10));
      const valid = (n: number) => Number.isInteger(n) && n > 0 && n < 100_000;
      return valid(w) && valid(h) ? { width: w, height: h } : {};
    };

    const assets = await Promise.all(
      files.map(async (file) => {
        const blob = await uploadImageToBlob(file);
        return createMediaAsset({
          url: blob.url,
          pathname: blob.pathname,
          filename: file.name,
          contentType: blob.contentType ?? file.type ?? undefined,
          sizeBytes: Number.isFinite(file.size) ? file.size : undefined,
          folder,
          ...dimensionsFor(file.name),
        });
      })
    );

    // `urls` is kept for the CSV import tool, which resolves uploaded filenames to URLs and
    // doesn't care about the asset records.
    return NextResponse.json({ assets, urls: assets.map((a) => a.url) });
  } catch (error) {
    // A rejected file is the uploader's mistake, not a server fault — it deserves the
    // reason and a 400, rather than the generic 500 an unrecognised throw would produce.
    if (error instanceof UploadRejectedError) return invalidInputResponse(error.message);
    return commerceErrorResponse(error);
  }
}
