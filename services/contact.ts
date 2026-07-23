import "server-only";
import { prisma } from "@/lib/prisma";
import type { ContactFormValues } from "@/lib/validations/contact";

export interface ContactMessage extends ContactFormValues {
  id: string;
  createdAt: string;
}

export async function createContactMessage(input: ContactFormValues): Promise<ContactMessage> {
  const row = await prisma.contactMessage.create({ data: input });
  return { ...input, id: row.id, createdAt: row.createdAt.toISOString() };
}

export async function getAllContactMessagesForAdmin(): Promise<ContactMessage[]> {
  const rows = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  }));
}
