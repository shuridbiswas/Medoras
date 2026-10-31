import { z } from "zod";
import { FIELDS } from "@/features/onboarding/options";
import { cleanText } from "@/features/network/schemas";
import {
  BIO_MAX,
  EXPERIENCE_FILTERS,
  GOALS_MAX,
  GOALS_MIN,
  MENTOR_FORMAT_VALUES,
  timeToMinutes,
} from "@/features/mentorship/options";
import type { MentorFormat } from "@/lib/supabase/database.types";

export const idSchema = z.uuid();

/** "nursing, exam prep" -> ["nursing", "exam prep"]: trimmed, lower-cased, de-duplicated. */
const list = (max: number, itemMax: number, label: string) =>
  z
    .string()
    .transform((v) => [...new Set(v.split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean))])
    .pipe(
      z
        .array(z.string().max(itemMax, `Keep each ${label} under ${itemMax} characters.`))
        .min(1, `Add at least one ${label}.`)
        .max(max, `Add up to ${max} ${label}s.`),
    );

export const mentorProfileSchema = z.object({
  bio: z.string().trim().min(20, "Tell mentees a little about yourself (at least 20 characters).").max(BIO_MAX, `Use ${BIO_MAX} characters or fewer.`),
  expertise: z.string().trim().min(3, "Describe your area of expertise.").max(200, "Use 200 characters or fewer."),
  experienceYears: z.coerce.number({ error: "Enter your years of experience." }).int("Use a whole number.").min(0, "Enter 0 or more.").max(60, "Enter 60 or fewer."),
  organization: z
    .string()
    .trim()
    .max(120, "Use 120 characters or fewer.")
    .optional()
    .transform((v) => (v ? v : undefined)),
  topics: list(10, 40, "topic"),
  languages: list(6, 30, "language"),
  capacity: z.coerce.number({ error: "Choose how many mentees." }).int().min(1, "Choose 1 to 10.").max(10, "Choose 1 to 10."),
  formats: z.array(z.enum(MENTOR_FORMAT_VALUES)).min(1, "Choose at least one session format."),
  accepting: z.boolean(),
  acknowledged: z.literal(true, { error: "Please confirm the statement above to list yourself." }),
});

export type MentorProfileInput = z.infer<typeof mentorProfileSchema>;

export const availabilitySchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    start: z.string().transform((v) => timeToMinutes(v)),
    end: z.string().transform((v) => timeToMinutes(v)),
    timezone: z
      .string()
      .trim()
      .min(1, "Enter your time zone.")
      .max(60)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, "Enter a valid time zone, such as America/Toronto."),
  })
  .refine((v) => v.start !== null && v.end !== null && v.end > v.start, { message: "The end time must be after the start time.", path: ["end"] });

export const requestSchema = z.object({
  mentorId: idSchema,
  goals: z
    .string()
    .trim()
    .min(GOALS_MIN, `Tell the mentor what you hope to get from this (at least ${GOALS_MIN} characters).`)
    .max(GOALS_MAX, `Use ${GOALS_MAX.toLocaleString("en-US")} characters or fewer.`),
  format: z.enum(MENTOR_FORMAT_VALUES).optional(),
});

export const decideSchema = z.object({
  requestId: idSchema,
  accept: z.boolean(),
  note: z.string().trim().max(500, "Use 500 characters or fewer.").optional(),
});

export const statusSchema = z.object({
  mentorshipId: idSchema,
  status: z.enum(["active", "paused", "completed", "ended"]),
});

export const feedbackSchema = z.object({
  mentorshipId: idSchema,
  rating: z.coerce.number().int().min(1, "Choose a rating from 1 to 5.").max(5, "Choose a rating from 1 to 5."),
  comment: z
    .string()
    .trim()
    .max(1000, "Use 1,000 characters or fewer.")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type MentorFilters = {
  q: string;
  field?: string;
  topic: string;
  language: string;
  minYears?: number;
  format?: MentorFormat;
  page: number;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Filters come from the URL, so unknown values are dropped instead of rejected. */
export function parseMentorFilters(params: Record<string, string | string[] | undefined>): MentorFilters {
  const field = first(params.field);
  const years = first(params.years);
  const format = first(params.format);
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  return {
    q: cleanText(first(params.q), 60),
    field: FIELDS.some((f) => f.value === field) ? field : undefined,
    topic: cleanText(first(params.topic), 40).toLowerCase(),
    language: cleanText(first(params.language), 30).toLowerCase(),
    minYears: EXPERIENCE_FILTERS.some((e) => e.value === years) ? Number(years) : undefined,
    format: (MENTOR_FORMAT_VALUES as string[]).includes(format ?? "") ? (format as MentorFormat) : undefined,
    page: Number.isFinite(page) ? Math.min(Math.max(page, 1), 200) : 1,
  };
}
