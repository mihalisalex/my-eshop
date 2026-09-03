import "server-only";
import { prisma } from "@/lib/prisma";
import { customerInclude, toCustomer } from "@/lib/commerce/postgres/mappers";
import { cartTotalsSchema } from "@/lib/validation/commerce";
import { round2 } from "@/lib/commerce/postgres/cart-totals";
import type { Address, Customer } from "@/lib/commerce/types";

export async function getCustomerById(id: string): Promise<Customer | null> {
  const row = await prisma.customer.findUnique({ where: { id }, include: customerInclude });
  return row ? toCustomer(row) : null;
}

export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  const row = await prisma.customer.findUnique({ where: { email: email.toLowerCase() }, include: customerInclude });
  return row ? toCustomer(row) : null;
}

export async function createCustomer(input: {
  email: string;
  /** Omitted for an OAuth-only signup — see findOrCreateCustomerForOAuth below. */
  passwordHash?: string;
  firstName: string;
  lastName: string;
}): Promise<Customer> {
  const row = await prisma.customer.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash ?? null,
      firstName: input.firstName,
      lastName: input.lastName,
    },
    include: customerInclude,
  });
  return toCustomer(row);
}

/**
 * Resolves an OAuth login to a Customer row: an existing linked account wins outright;
 * failing that, a verified-email match on an existing password-based Customer is
 * auto-linked (Google/Apple/Facebook all verify email ownership before issuing a token,
 * so this matches the trust level this app already extends to plain email/password
 * sign-up, which has no separate email-verification step either); failing that, a new
 * Customer + CustomerOAuthAccount are created together.
 */
export async function findOrCreateCustomerForOAuth(input: {
  provider: string;
  providerUserId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}): Promise<Customer> {
  const existingAccount = await prisma.customerOAuthAccount.findUnique({
    where: { provider_providerUserId: { provider: input.provider, providerUserId: input.providerUserId } },
    include: { customer: { include: customerInclude } },
  });
  if (existingAccount) return toCustomer(existingAccount.customer);

  const email = input.email?.toLowerCase();
  const existingCustomer = email ? await prisma.customer.findUnique({ where: { email } }) : null;

  if (existingCustomer) {
    await prisma.customerOAuthAccount.create({
      data: { customerId: existingCustomer.id, provider: input.provider, providerUserId: input.providerUserId, email: input.email },
    });
    return (await getCustomerById(existingCustomer.id))!;
  }

  const created = await prisma.customer.create({
    data: {
      email: email ?? `${input.provider}-${input.providerUserId}@oauth.alexandris.invalid`,
      passwordHash: null,
      firstName: input.firstName ?? "Customer",
      lastName: input.lastName ?? "",
      oauthAccounts: { create: { provider: input.provider, providerUserId: input.providerUserId, email: input.email } },
    },
    include: customerInclude,
  });
  return toCustomer(created);
}

export async function updateCustomerProfile(
  customerId: string,
  patch: Partial<Pick<Customer, "firstName" | "lastName" | "phone" | "acceptsMarketing">>
): Promise<Customer> {
  const row = await prisma.customer.update({ where: { id: customerId }, data: patch, include: customerInclude });
  return toCustomer(row);
}

export async function addCustomerAddress(customerId: string, address: Address): Promise<Customer> {
  const position = await prisma.customerAddress.count({ where: { customerId } });
  await prisma.customerAddress.create({ data: { customerId, position, ...address } });
  return (await getCustomerById(customerId))!;
}

async function requireOwnAddress(customerId: string, addressId: string) {
  const address = await prisma.customerAddress.findUnique({ where: { id: addressId } });
  if (!address || address.customerId !== customerId) {
    throw new Error("Address not found.");
  }
  return address;
}

export async function updateCustomerAddress(customerId: string, addressId: string, address: Address): Promise<Customer> {
  await requireOwnAddress(customerId, addressId);
  await prisma.customerAddress.update({ where: { id: addressId }, data: address });
  return (await getCustomerById(customerId))!;
}

export async function removeCustomerAddress(customerId: string, addressId: string): Promise<Customer> {
  await requireOwnAddress(customerId, addressId);
  await prisma.customerAddress.delete({ where: { id: addressId } });
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (customer?.defaultAddressId === addressId) {
    await prisma.customer.update({ where: { id: customerId }, data: { defaultAddressId: null } });
  }
  return (await getCustomerById(customerId))!;
}

export async function updateCustomerPasswordHash(customerId: string, passwordHash: string): Promise<void> {
  await prisma.customer.update({
    where: { id: customerId },
    // Retires every session issued before now (AUTH-001). Changing a password is the one
    // action people take specifically to lock somebody else out, so it has to.
    data: { passwordHash, sessionsValidFrom: new Date() },
  });
}

export async function getAllCustomersForAdmin(): Promise<(Customer & { ordersCount: number; totalSpent: number })[]> {
  const rows = await prisma.customer.findMany({
    include: { ...customerInclude, orders: { select: { totals: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => {
    const customer = toCustomer(row);
    const totalSpent = row.orders.reduce((sum, order) => sum + cartTotalsSchema.parse(order.totals).total.amount, 0);
    return { ...customer, ordersCount: row.orders.length, totalSpent: round2(totalSpent) };
  });
}
