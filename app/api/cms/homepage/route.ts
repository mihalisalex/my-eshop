import { NextResponse } from "next/server";
import { getHomepageConfig } from "@/services/homepage";

export async function GET() {
  const homepage = await getHomepageConfig();
  return NextResponse.json({ homepage });
}
