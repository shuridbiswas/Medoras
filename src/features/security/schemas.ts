import { z } from "zod";

export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app.");

export const factorIdSchema = z.uuid("That authenticator is not valid.");

export const recoveryCodeSchema = z
  .string()
  .trim()
  .min(8, "Enter one of your recovery codes.")
  .max(40, "That is too long to be a recovery code.");

export const reauthSchema = z.object({
  password: z.string().min(1, "Enter your password.").max(200),
});

export type SecurityFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const idleSecurityForm: SecurityFormState = { status: "idle" };
