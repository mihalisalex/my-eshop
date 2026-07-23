"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-session";
import { saveHomepageSections } from "@/services/homepage";
import type { HomepageSection } from "@/types";

export async function publishHomepageSections(sections: HomepageSection[]): Promise<void> {
  await requireAdminSession();
  await saveHomepageSections(sections);
  revalidatePath("/", "layout");
}
