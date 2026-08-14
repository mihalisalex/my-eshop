import "server-only";
import { prisma } from "@/lib/prisma";
import type { ConciergeFormValues } from "@/lib/validation/concierge";

export interface ConciergeRequest extends ConciergeFormValues {
  id: string;
  status: "open" | "responded" | "closed";
  createdAt: string;
}

export async function createConciergeRequest(input: ConciergeFormValues, customerId?: string): Promise<ConciergeRequest> {
  const row = await prisma.conciergeRequest.create({ data: { ...input, customerId } });
  return { ...input, id: row.id, status: row.status as ConciergeRequest["status"], createdAt: row.createdAt.toISOString() };
}

export async function getAllConciergeRequestsForAdmin(): Promise<ConciergeRequest[]> {
  const rows = await prisma.conciergeRequest.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    topic: row.topic,
    message: row.message,
    status: row.status as ConciergeRequest["status"],
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function updateConciergeRequestStatus(id: string, status: ConciergeRequest["status"]): Promise<void> {
  await prisma.conciergeRequest.update({ where: { id }, data: { status } });
}
