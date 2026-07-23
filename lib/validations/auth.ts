import { z } from "zod";

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
  password: z.string().min(8, "Use at least 8 characters"),
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
  newPassword: z.string().min(8, "Use at least 8 characters"),
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
  password: z.string().min(8, "Use at least 8 characters"),
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
