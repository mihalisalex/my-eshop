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
  | "content:media"
  | "content:media-delete"
  | "content:publish"
  | "content:navigation"
  | "orders:view"
  | "orders:manage"
  | "orders:returns"
  | "payments:view"
  | "payments:manage"
  | "payments:refund"
  | "payments:configure"
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
  { key: "content:media", group: "Content", label: "Upload and organise media" },
  {
    key: "content:media-delete",
    group: "Content",
    label: "Delete media permanently",
    note: "Deletion also removes the file from blob storage and can't be undone. Images still used by a product, category or page are blocked from deletion for everyone.",
  },
  { key: "content:publish", group: "Content", label: "Publish homepage sections and hero" },
  { key: "content:navigation", group: "Content", label: "Manage the navigation menu" },
  { key: "orders:view", group: "Customers & Orders", label: "View orders and customers" },
  { key: "orders:manage", group: "Customers & Orders", label: "Update order status and answer concierge requests" },
  { key: "orders:returns", group: "Customers & Orders", label: "Approve and process returns" },
  { key: "payments:view", group: "Payments", label: "View payments and their transaction history" },
  {
    key: "payments:manage",
    group: "Payments",
    label: "Confirm and cancel payments",
    note: "Marking a Cash-on-Delivery or bank-transfer payment as received is an accounting statement, not an order update — it says the shop has the money.",
  },
  {
    key: "payments:refund",
    group: "Payments",
    label: "Issue refunds",
    note: "Separate from confirming a payment because it moves money back out, often through a live provider API, and can't be undone.",
  },
  {
    key: "payments:configure",
    group: "Payments",
    label: "Configure providers, credentials and fees",
    note: "Grants access to payment API credentials and controls what customers can pay with. Kept to owners for the same reason as user management.",
  },
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
  // Editors upload images as a normal part of editing products and posts, but deleting
  // from blob storage is irreversible — same archive-vs-hard-delete split as products.
  "content:media",
  "orders:view",
  "orders:manage",
  // Editors can SEE payments — they need to know whether an order has been paid for
  // before dispatching it. Confirming, refunding and configuring are all withheld:
  // each of those either moves money or exposes live payment credentials.
  "payments:view",
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
