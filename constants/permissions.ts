import type { AdminRole } from "@/types/admin";

/**
 * Machine-readable capabilities — the single source of truth for BOTH server-side
 * enforcement (lib/admin-session.ts's requireCapability) and the /admin/roles matrix.
 *
 * This file previously held only display strings with `admin: true / editor: false`
 * booleans, and nothing read them: the JWT didn't even carry a role, requireAdminSession
 * only checked "is there a session", and RoleSelect was local useState that never
 * persisted. The result was that an "editor" silently had full admin powers while the
 * roles page told the store owner otherwise. Keeping the matrix and the guard on one
 * definition is what stops that drift from coming back.
 */
export type Capability =
  | "catalog:view"
  | "catalog:edit"
  | "catalog:delete"
  | "catalog:discounts"
  | "content:blog"
  | "content:publish"
  | "content:navigation"
  | "orders:view"
  | "orders:manage"
  | "orders:returns"
  | "admin:users"
  | "admin:settings"
  | "admin:activity";

export interface CapabilityDefinition {
  key: Capability;
  group: string;
  label: string;
  /** Shown on the roles page where the reason for a restriction isn't self-evident. */
  note?: string;
}

/**
 * Order here drives the roles page's display order. Grouping mirrors the admin nav so a
 * store owner can map a capability to the section it governs.
 */
export const CAPABILITIES: CapabilityDefinition[] = [
  { key: "catalog:view", group: "Catalog", label: "View products, collections, categories" },
  { key: "catalog:edit", group: "Catalog", label: "Create and edit products, categories, collections" },
  {
    key: "catalog:delete",
    group: "Catalog",
    label: "Permanently delete catalog records",
    note: "Editors can archive a product (reversible) but not hard-delete it, which also strips it from customers' carts and wishlists.",
  },
  { key: "catalog:discounts", group: "Catalog", label: "Manage discounts and gift cards" },
  { key: "content:blog", group: "Content", label: "Manage blog posts" },
  { key: "content:publish", group: "Content", label: "Publish homepage sections and hero" },
  { key: "content:navigation", group: "Content", label: "Manage the navigation menu" },
  { key: "orders:view", group: "Customers & Orders", label: "View orders and customers" },
  { key: "orders:manage", group: "Customers & Orders", label: "Update order status and answer concierge requests" },
  { key: "orders:returns", group: "Customers & Orders", label: "Approve and process returns" },
  { key: "admin:users", group: "Administration", label: "Manage users and roles" },
  { key: "admin:settings", group: "Administration", label: "Edit site settings and SEO" },
  { key: "admin:activity", group: "Administration", label: "View the activity log" },
];

/**
 * Admin intentionally gets every capability by construction rather than an enumerated
 * list — a new capability must never silently lock the owner out of their own dashboard.
 */
const EDITOR_CAPABILITIES: Capability[] = [
  "catalog:view",
  "catalog:edit",
  "content:blog",
  "orders:view",
  "orders:manage",
  "admin:activity",
];

export const ROLE_CAPABILITIES: Record<AdminRole, Capability[]> = {
  admin: CAPABILITIES.map((c) => c.key),
  editor: EDITOR_CAPABILITIES,
};

export function roleHasCapability(role: AdminRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

/** Capability definitions bucketed by group, preserving CAPABILITIES' order. */
export function capabilitiesByGroup(): { title: string; capabilities: CapabilityDefinition[] }[] {
  const groups: { title: string; capabilities: CapabilityDefinition[] }[] = [];
  for (const capability of CAPABILITIES) {
    const existing = groups.find((g) => g.title === capability.group);
    if (existing) existing.capabilities.push(capability);
    else groups.push({ title: capability.group, capabilities: [capability] });
  }
  return groups;
}
