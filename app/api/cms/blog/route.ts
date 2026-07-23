import { NextResponse } from "next/server";
import { getAllPosts } from "@/services/blog";

export async function GET() {
  const posts = await getAllPosts();
  return NextResponse.json({ posts });
}
