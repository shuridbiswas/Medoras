import { z } from "zod";

export const privacySettingsSchema = z.object({
  profileVisibility: z.enum(["members", "connections"], { error: "Choose who can see your details." }),
  directoryListed: z.boolean(),
});

export type PrivacyFormState = { status: "idle" | "success" | "error"; message?: string };
export const idlePrivacyForm: PrivacyFormState = { status: "idle" };
