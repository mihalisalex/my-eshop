"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/admin-session";
import { saveShippingSettings } from "@/services/shipping";
import type { ShippingSettings } from "@/types";

export async function saveShippingSettingsAction(settings: ShippingSettings): Promise<void> {
  await requireCapability("admin:settings");
  await saveShippingSettings(settings);
  // Shipping shows up in cart totals and at checkout on every page that renders a cart, so
  // this invalidates the whole tree rather than a single route.
  revalidatePath("/", "layout");
}
