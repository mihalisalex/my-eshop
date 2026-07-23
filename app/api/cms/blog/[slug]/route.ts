import { NextResponse } from "next/server";
import { getPostBySlug } from "@/services/blog";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  return NextResponse.json({ post: post ?? null });
}
