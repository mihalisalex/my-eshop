import { z } from "zod";

/**
 * The passwords that actually get used, not a composition rule.
 *
 * The policy was a bare 8-character minimum, which "password" and "12345678" both
 * satisfy. Following current NIST guidance this screens against known-common choices
 * rather than demanding an uppercase-number-symbol mix — composition rules mostly
 * produce "Password1!" and push people toward reuse. A real deployment should upgrade
 * this to a breach-corpus check (Have I Been Pwned's k-anonymity range API needs no
 * account and never sees the password); this list is the offline floor under that.
 */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "p@ssword", "p@ssw0rd",
  "12345678", "123456789", "1234567890", "123123123", "11111111", "00000000",
  "qwertyui", "qwerty123", "qwertyuiop", "asdfghjk", "asdfghjkl", "1q2w3e4r",
  "iloveyou", "princess", "sunshine", "football", "baseball", "superman",
  "trustno1", "letmein1", "welcome1", "monkey12", "dragon123", "abc12345",
  "admin123", "administrator", "changeme", "secret12", "starwars",
]);

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(200, "Use fewer than 200 characters")
  .refine(
    (value) => !COMMON_PASSWORDS.has(value.toLowerCase()),
    "That password is too common — please choose another"
  );

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const magicLinkSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
});
export type MagicLinkFormValues = z.infer<typeof magicLinkSchema>;

const baseRegisterSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: passwordSchema,
});

export const registerSchema = baseRegisterSchema
  .extend({ confirmPassword: z.string().min(1, "Confirm your password") })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type RegisterFormValues = z.infer<typeof registerSchema>;

/**
 * The API-body subset of registerSchema — AuthSignUpInput has no confirmPassword
 * field (the client already validated the match before calling signUp).
 * `referralCode` is invisible in the register form itself — AuthProvider.signUp
 * merges it in from localStorage (see lib/referral.ts) right before the API call.
 */
export const signUpInputSchema = baseRegisterSchema.extend({ referralCode: z.string().trim().optional() });
export type SignUpInputValues = z.infer<typeof signUpInputSchema>;

export const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  phone: z.string().trim().optional(),
});
export type ProfileFormValues = z.infer<typeof profileSchema>;

const baseSecuritySchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export const securitySchema = baseSecuritySchema
  .extend({ confirmNewPassword: z.string().min(1, "Confirm your new password") })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords don't match",
    path: ["confirmNewPassword"],
  });
export type SecurityFormValues = z.infer<typeof securitySchema>;

/** The API-body subset of securitySchema — no confirmNewPassword. */
export const changePasswordInputSchema = baseSecuritySchema;
export type ChangePasswordInputValues = z.infer<typeof changePasswordInputSchema>;

const baseResetPasswordSchema = z.object({
  token: z.string().min(1, "Missing reset token"),
  password: passwordSchema,
});

export const resetPasswordSchema = baseResetPasswordSchema
  .extend({ confirmPassword: z.string().min(1, "Confirm your new password") })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

/** The API-body subset of resetPasswordSchema — no confirmPassword. */
export const resetPasswordInputSchema = baseResetPasswordSchema;
export type ResetPasswordInputValues = z.infer<typeof resetPasswordInputSchema>;
