import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address.")
  .max(254, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."));

/**
 * At least 10 characters with a letter and a number. 72 is bcrypt's byte limit.
 * Keep the Supabase project's minimum password length at or below 10.
 */
export const passwordRules = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Use 72 characters or fewer.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter your ${label}.`)
    .max(60, `Your ${label} must be 60 characters or fewer.`)
    .regex(/^[^<>]*$/, `Your ${label} can't contain < or >.`);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(200),
  remember: z.boolean(),
});

export const signupSchema = z
  .object({
    firstName: name("first name"),
    lastName: name("last name"),
    email,
    password: passwordRules,
    confirmPassword: z.string().min(1, "Confirm your password."),
    acceptTerms: z.literal(true, {
      error: "You need to agree to the Terms and Privacy Policy.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: passwordRules,
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  });

export const resendSchema = z.object({ email });

export type FieldErrors = Record<string, string[] | undefined>;

export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
  /** Non-sensitive values to put back in the form after an error. Never passwords. */
  values?: Record<string, string>;
  /** Login only: the account exists but the email is not verified yet. */
  needsVerification?: boolean;
  email?: string;
};

export const initialAuthState: AuthFormState = { status: "idle" };

export function flattenErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
