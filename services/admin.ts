import "server-only";
import activityLogData from "@/data/activity-log.json";
import { prisma } from "@/lib/prisma";
import { cartTotalsSchema } from "@/lib/validation/commerce";
import { getNewsletterSubscriberCount } from "@/services/newsletter";
import type { ActivityLogEntry, AdminUser, DashboardStat } from "@/types";

/**
 * Orders/Customers/Discounts/GiftCards/Returns moved to services/orders.ts,
 * services/customers.ts, services/discounts.ts, services/gift-cards.ts,
 * services/returns.ts, and Newsletter to services/newsletter.ts (all
 * Postgres-backed now). This file keeps the domains still genuinely
 * mock/JSON-backed — currently just the activity log.
 */

const activityLog = activityLogData as ActivityLogEntry[];

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

export async function getActivityLog(): Promise<ActivityLogEntry[]> {
  return [...activityLog].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
