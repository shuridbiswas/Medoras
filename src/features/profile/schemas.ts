import { z } from "zod";
import {
  CAREER_STAGES,
  EMPLOYMENT_TYPES,
  FIELDS,
  MEMBER_TYPES,
  values,
} from "@/features/onboarding/options";
import { optionalText, requiredText } from "@/lib/validation";

export const COVER_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const SKILL_KINDS = ["skill", "interest", "mentorship_area"] as const;
export const SKILL_LIMITS = {
  skill: 30,
  interest: 20,
  mentorship_area: 10,
} as const;

export const basicsSchema = z.object({
  firstName: requiredText("first name", 60),
  lastName: requiredText("last name", 60),
  headline: requiredText("headline", 120).pipe(
    z.string().min(3, "Use at least 3 characters."),
  ),
  locationLabel: optionalText(80),
  memberType: z.enum(values(MEMBER_TYPES), { error: "Choose your role." }),
  fields: z
    .array(z.enum(values(FIELDS)))
    .min(1, "Choose at least one field.")
    .max(5, "Choose up to 5 fields."),
  institution: requiredText("institution or organization", 120),
  qualification: requiredText("education or qualification", 120),
  specialty: optionalText(120),
  careerStage: z.enum(values(CAREER_STAGES), {
    error: "Choose your career stage.",
  }),
});

export const aboutSchema = z.object({
  bio: optionalText(1000),
  professionalJourney: optionalText(2000),
  careerAspirations: optionalText(1000),
});

export const mentorshipSchema = z.object({
  lookingForMentorship: z.boolean(),
  openToMentor: z.boolean(),
});

const year = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .pipe(
    z
      .string()
      .regex(/^\d{4}$/, "Enter a 4-digit year.")
      .transform(Number)
      .refine(
        (n) => n >= 1940 && n <= 2100,
        "Enter a year between 1940 and 2100.",
      )
      .optional(),
  );

const month = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month and year.")
  .refine((v) => {
    const y = Number(v.slice(0, 4));
    return y >= 1940 && y <= 2100;
  }, "Enter a year between 1940 and 2100.");

const optionalMonth = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .pipe(month.optional());

const entryId = z.uuid("That entry is not valid.").optional();

export const educationEntrySchema = z
  .object({
    id: z
      .string()
      .transform((v) => (v === "" ? undefined : v))
      .pipe(entryId),
    institution: requiredText("institution", 120),
    qualification: requiredText("degree or qualification", 120),
    fieldOfStudy: optionalText(120),
    startYear: year,
    endYear: year,
    currentlyStudying: z.boolean(),
    description: optionalText(1000),
  })
  .refine(
    (d) =>
      d.currentlyStudying ||
      d.endYear === undefined ||
      d.startYear === undefined ||
      d.endYear >= d.startYear,
    {
      path: ["endYear"],
      message: "The end year can't be before the start year.",
    },
  )
  // A current program has no end year; drop it rather than reject the form.
  .transform((d) => ({
    ...d,
    endYear: d.currentlyStudying ? undefined : d.endYear,
  }));

export const experienceEntrySchema = z
  .object({
    id: z
      .string()
      .transform((v) => (v === "" ? undefined : v))
      .pipe(entryId),
    title: requiredText("job title", 120),
    organization: requiredText("organization", 120),
    employmentType: z
      .string()
      .transform((v) => (v === "" ? undefined : v))
      .pipe(
        z
          .enum(values(EMPLOYMENT_TYPES), {
            error: "Choose an employment type.",
          })
          .optional(),
      ),
    startMonth: month,
    endMonth: optionalMonth,
    isCurrent: z.boolean(),
    description: optionalText(2000),
  })
  .refine((d) => d.isCurrent || !d.endMonth || d.endMonth >= d.startMonth, {
    path: ["endMonth"],
    message: "The end date can't be before the start date.",
  })
  .transform((d) => ({ ...d, endMonth: d.isCurrent ? undefined : d.endMonth }));

/** One tag, cleaned the same way the database expects: trimmed, collapsed spaces, no markup. */
export const tagSchema = z
  .string()
  .transform((v) => v.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(2, "Use at least 2 characters.")
      .max(40, "Use 40 characters or fewer.")
      .regex(/^[^<>]*$/, "Remove < and > characters."),
  );

export const skillsSchema = z.object({
  kind: z.enum(SKILL_KINDS),
  names: z.array(tagSchema),
});

export const deleteEntrySchema = z.object({
  id: z.uuid("That entry is not valid."),
});

export type ProfileFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const idleState: ProfileFormState = { status: "idle" };

/** "2024-05" -> "2024-05-01" for a date column. */
export const monthToDate = (value: string) => `${value}-01`;
/** "2024-05-01" -> "2024-05" for a month input. */
export const dateToMonth = (value: string | null) =>
  value ? value.slice(0, 7) : "";
