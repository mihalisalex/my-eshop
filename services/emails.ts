import "server-only";
import { prisma } from "@/lib/prisma";

export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  sentAt: string;
}

function toEmailLogEntry(row: { id: string; to: string; subject: string; html: string; text: string; template: string; sentAt: Date }): EmailLogEntry {
  return { ...row, sentAt: row.sentAt.toISOString() };
}

export async function getAllEmailLogsForAdmin(): Promise<EmailLogEntry[]> {
  const rows = await prisma.emailLog.findMany({ orderBy: { sentAt: "desc" }, take: 200 });
  return rows.map(toEmailLogEntry);
}

export async function getEmailLogById(id: string): Promise<EmailLogEntry | null> {
  const row = await prisma.emailLog.findUnique({ where: { id } });
  return row ? toEmailLogEntry(row) : null;
}
