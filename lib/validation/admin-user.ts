import { z } from "zod";
import { ADMIN_ROLES, type AdminRole } from "@/types/admin";

/**
 * Admin credentials are held to the SAME password rules as customer accounts
 * (lib/validation/auth.ts) rather than a looser bar — an admin password unlocks the
 * whole dashboard, every customer's address and the payment configuration, so it is the
 * last credential that should be allowed to be "password123".
 *
 * Duplicated deliberately rather than imported: lib/validation/auth.ts is the customer
 * surface and this is the staff one, and a future change to either (2FA here, a breach
 * check there) should not silently move the other.
 */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "p@ssword", "p@ssw0rd",
  "12345678", "123456789", "1234567890", "123123123", "11111111", "00000000",
  "qwertyui", "qwerty123", "qwertyuiop", "asdfghjk", "asdfghjkl", "1q2w3e4r",
  "iloveyou", "princess", "sunshine", "football", "baseball", "superman",
  "trustno1", "letmein1", "welcome1", "monkey12", "dragon123", "abc12345",
  "admin123", "administrator", "changeme", "secret12", "starwars",
]);

export const adminPasswordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "Use fewer than 200 characters")
  .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), "That password is too common — choose another");

export const adminRoleSchema = z.enum(ADMIN_ROLES as [AdminRole, ...AdminRole[]]);

export const createAdminUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z
    .string({ error: "Email is required" })
    .trim()
    .toLowerCase()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: adminPasswordSchema,
  role: adminRoleSchema,
});
export type CreateAdminUserValues = z.infer<typeof createAdminUserSchema>;

export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: adminPasswordSchema,
});
export type ChangeOwnPasswordValues = z.infer<typeof changeOwnPasswordSchema>;
