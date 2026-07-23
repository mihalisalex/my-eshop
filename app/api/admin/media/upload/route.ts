import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";
import { uploadImageToBlob } from "@/lib/blob";

export async function POST(request: Request) {
  try {
    await requireAdminSession();
    const form = await request.formData();
    const files = form.getAll("file").filter((value): value is File => value instanceof File);
    if (files.length === 0) return invalidInputResponse("No files were provided.");

    const uploaded = await Promise.all(files.map((file) => uploadImageToBlob(file)));
    return NextResponse.json({ urls: uploaded.map((u) => u.url) });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
