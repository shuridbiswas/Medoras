import { z } from "zod";
import {
  optionalText as optional,
  requiredText as required,
} from "@/lib/validation";
import {
  CAREER_STAGES,
  COUNTRY_CODES,
  FIELDS,
  MEMBER_TYPES,
  PURPOSES,
  RESERVED_USERNAMES,
  values,
} from "@/features/onboarding/options";

export const whoSchema = z.object({
  memberType: z.enum(values(MEMBER_TYPES), {
    error: "Choose the option that fits you best.",
  }),
});

export const fieldSchema = z.object({
  fields: z
    .array(z.enum(values(FIELDS)))
    .min(1, "Choose at least one field.")
    .max(5, "Choose up to 5 fields."),
});

export const educationSchema = z.object({
  institution: required("institution or organization", 120),
  qualification: required("current education or qualification", 120),
  specialty: optional(120),
  careerStage: z.enum(values(CAREER_STAGES), {
    error: "Choose your career stage.",
  }),
  country: z.enum(COUNTRY_CODES, { error: "Choose your country." }),
  city: optional(80),
});

export const purposeSchema = z.object({
  purposes: z
    .array(z.enum(values(PURPOSES)))
    .min(1, "Choose at least one reason.")
    .max(7),
});

export const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Use at least 3 characters.")
    .max(30, "Use 30 characters or fewer.")
    .regex(/^[a-z0-9_]+$/, "Use only letters, numbers and underscores.")
    .refine(
      (v) => !(RESERVED_USERNAMES as readonly string[]).includes(v),
      "That username isn't available.",
    ),
  headline: required("headline", 120).pipe(
    z.string().min(3, "Use at least 3 characters."),
  ),
  bio: optional(1000),
});

export const onboardingSchema = z.object({
  ...whoSchema.shape,
  ...fieldSchema.shape,
  ...educationSchema.shape,
  ...purposeSchema.shape,
  ...profileSchema.shape,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** Which wizard step each field belongs to, so server errors can send the member back. */
export const STEP_OF_FIELD: Record<string, number> = {
  memberType: 0,
  fields: 1,
  institution: 2,
  qualification: 2,
  specialty: 2,
  careerStage: 2,
  country: 2,
  city: 2,
  purposes: 3,
  username: 4,
  headline: 4,
  bio: 4,
  avatar: 4,
};

export const STEP_SCHEMAS = [
  whoSchema,
  fieldSchema,
  educationSchema,
  purposeSchema,
  profileSchema,
] as const;

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type OnboardingState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Wizard step to show after a server-side error. */
  step?: number;
};
