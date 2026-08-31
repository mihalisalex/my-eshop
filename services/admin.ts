import "server-only";
import { prisma } from "@/lib/prisma";
import { cartTotalsSchema } from "@/lib/validation/commerce";
import { getNewsletterSubscriberCount } from "@/services/newsletter";
import type { AdminUser, DashboardStat } from "@/types";

/**
 * Orders/Customers/Discounts/GiftCards/Returns moved to services/orders.ts,
 * services/customers.ts, services/discounts.ts, services/gift-cards.ts,
 * services/returns.ts, and Newsletter to services/newsletter.ts (all
 * Postgres-backed now).
 *
 * The activity log used to live here and has been REMOVED, not migrated. It read
 * data/activity-log.json — a file of seeded, invented entries — and presented them at
 * /admin/activity under the heading "Recent actions taken across this dashboard". Nothing
 * ever wrote to it, so it could only ever show a fixed set of things that never happened.
 *
 * That is worse than having no audit log, because it is the screen someone opens during an
 * incident to find out who changed a price, and it would answer confidently and wrongly.
 * An honest absence is recoverable; a convincing fabrication is not. The real thing is an
 * AdminAuditLog table written from this service layer, with the same append-only
 * discipline PaymentTransaction already uses for payments — deliberately left undone here
 * rather than faked.
 */

/**
 * Reads the real `AdminUser` table (Postgres, Real Backend Phase 1) — this
 * was still reading data/admin-users.json until now, a leftover gap from
 * that migration: admin login (app/admin/actions.ts) already used Prisma,
 * but this list didn't, so an admin created directly in the database never
 * showed up here (and vice versa). Never returns `passwordHash`.
 */
export async function getAdminUsers(): Promise<AdminUser[]> {
  const rows = await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role === "editor" ? "editor" : "admin",
  }));
}

export async function getDashboardStats(): Promise<DashboardStat[]> {
  const [orders, customerCount, subscriberCount] = await Promise.all([
    prisma.order.findMany({ select: { totals: true } }),
    prisma.customer.count(),
    getNewsletterSubscriberCount(),
  ]);
  const revenue = orders.reduce((sum, order) => sum + cartTotalsSchema.parse(order.totals).total.amount, 0);

  return [
    { id: "revenue", label: "Revenue", value: `€${revenue.toLocaleString()}` },
    { id: "orders", label: "Orders", value: String(orders.length) },
    { id: "customers", label: "Customers", value: String(customerCount) },
    { id: "subscribers", label: "Newsletter Subscribers", value: String(subscriberCount) },
  ];
}
