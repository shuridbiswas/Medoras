import { z } from "zod";

export const emailCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from your email.");

export const reauthSchema = z.object({
  password: z.string().min(1, "Enter your password.").max(200),
});

export type SecurityFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const idleSecurityForm: SecurityFormState = { status: "idle" };
