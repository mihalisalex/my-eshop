import { NextResponse } from "next/server";
import { getNavigation } from "@/services/navigation";

export async function GET() {
  const navigation = await getNavigation();
  return NextResponse.json({ navigation });
}
