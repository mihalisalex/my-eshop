import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/admin-session";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";
import { uploadImageToBlob } from "@/lib/blob";
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

    const form = await request.formData();
    const files = form.getAll("file").filter((value): value is File => value instanceof File);
    if (files.length === 0) return invalidInputResponse("No files were provided.");

    const folderValue = form.get("folder");
    const folder = typeof folderValue === "string" && folderValue.trim() !== "" ? folderValue.trim() : undefined;

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
        });
      })
    );

    // `urls` is kept for the CSV import tool, which resolves uploaded filenames to URLs and
    // doesn't care about the asset records.
    return NextResponse.json({ assets, urls: assets.map((a) => a.url) });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
