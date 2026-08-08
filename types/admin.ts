/** What an admin account is allowed to do — see constants/permissions.ts for the mapping. */
export type AdminRole = "admin" | "editor";

export const ADMIN_ROLES: AdminRole[] = ["admin", "editor"];

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  avatar?: string;
}

export interface DashboardStat {
  id: string;
  label: string;
  value: string;
  delta?: number;
  trend?: "up" | "down" | "flat";
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  /** Which surface the signup came from, e.g. "footer" | "homepage". */
  source?: string;
  subscribedAt: string;
}

export interface ActivityLogEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  createdAt: string;
}
