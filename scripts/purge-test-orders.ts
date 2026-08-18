import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Removes the test orders left in the production database during development (QA-012).
 *
 * They are not harmless clutter: the admin dashboard sums every order, so day-one revenue
 * read EUR 1,196.43 of money that was never taken, and Analytics counted them as real
 * demand.
 *
 * Targets are matched by an EXPLICIT allow-list of ids rather than a pattern. A pattern
 * like "contains example.com" would be one typo away from deleting a real customer's
 * order, and this is irreversible — orders carry no soft delete. Run with --dry-run first;
 * it prints exactly what it would remove and writes nothing.
 *
 * Stock is NOT credited back. These orders never shipped and never reserved anything a
 * customer is waiting on, and the catalog quantities were re-baselined separately; adding
 * units here would invent stock rather than restore it.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** The six seeded/QA orders, identified during the pre-launch audit. */
const TEST_ORDER_EMAILS = [
  "client-test@example.com",
  "orderone@example.com",
  "ordertwo@example.com",
  "perftest@example.com",
  "giftwraptest@example.com",
  "aDFWA@qFSDA.COM",
];

async function main() {
  const dryRun = process.argv[2] === "--dry-run";

  const all = await prisma.order.findMany({
    select: { id: true, customerEmail: true, status: true, totals: true, createdAt: true, checkoutId: true },
    orderBy: { createdAt: "asc" },
  });

  const targets = all.filter((order) =>
    TEST_ORDER_EMAILS.some((email) => email.toLowerCase() === order.customerEmail.toLowerCase())
  );
  const keeping = all.filter((order) => !targets.includes(order));

  type Totals = { total?: { amount?: number } };
  const amountOf = (order: { totals: unknown }) => Number((order.totals as Totals)?.total?.amount ?? 0);
  const sum = (rows: typeof all) => rows.reduce((total, order) => total + amountOf(order), 0);

  console.log("WILL DELETE");
  for (const order of targets) {
    console.log(`  ${order.id}  ${order.customerEmail.padEnd(28)} ${order.status.padEnd(10)} EUR ${amountOf(order).toFixed(2)}  ${order.createdAt.toISOString().slice(0, 10)}`);
  }
  console.log("\nWILL KEEP");
  for (const order of keeping) {
    console.log(`  ${order.id}  ${order.customerEmail.padEnd(28)} ${order.status.padEnd(10)} EUR ${amountOf(order).toFixed(2)}  ${order.createdAt.toISOString().slice(0, 10)}`);
  }
  console.log(`\nrevenue before EUR ${sum(all).toFixed(2)} -> after EUR ${sum(keeping).toFixed(2)}`);

  if (dryRun) {
    console.log("\n(dry run — nothing written)");
    return;
  }

  for (const order of targets) {
    // Payments cascade from Order, but deleting them explicitly keeps the intent visible
    // and survives any future change to the cascade rule.
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.return.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.checkout.deleteMany({ where: { id: order.checkoutId } });
  }

  console.log(`\nDELETED ${targets.length} orders. Remaining: ${await prisma.order.count()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
