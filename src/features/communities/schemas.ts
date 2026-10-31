import { z } from "zod";
import { COUNTRY_CODES } from "@/features/onboarding/options";
import { cleanText } from "@/features/network/schemas";
import {
  COMMUNITY_KIND_VALUES,
  REMOVAL_REASON_VALUES,
  RULES_MAX,
  type RemovalReason,
} from "@/features/communities/options";
import type { CommunityKind } from "@/lib/supabase/database.types";

const text = (min: number, max: number, empty: string) =>
  z
    .string()
    .trim()
    .min(min, empty)
    .max(max, `Use ${max.toLocaleString("en-US")} characters or fewer.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max.toLocaleString("en-US")} characters or fewer.`)
    .optional()
    .transform((v) => (v ? v : undefined));

const COUNTRIES = COUNTRY_CODES as readonly string[];

export const communityFieldsSchema = z.object({
  name: text(3, 80, "Give the community a name of at least 3 characters."),
  description: text(10, 600, "Describe the community in at least 10 characters."),
  kind: z.enum(COMMUNITY_KIND_VALUES, { error: "Choose what kind of community this is." }),
  visibility: z.enum(["public", "private"], { error: "Choose who can see inside." }),
  rules: optionalText(RULES_MAX),
  institution: optionalText(120),
  regionLabel: optionalText(80),
  country: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined))
    .refine((v) => v === undefined || COUNTRIES.includes(v), "Choose a country from the list."),
});

export type CommunityFields = z.infer<typeof communityFieldsSchema>;

export const idSchema = z.uuid();

export const requestMessageSchema = z.object({
  communityId: idSchema,
  message: optionalText(500),
});

export const announcementSchema = z.object({
  communityId: idSchema,
  title: text(3, 120, "Give the announcement a title."),
  body: text(1, 2000, "Write the announcement."),
});

export const roleSchema = z.object({
  communityId: idSchema,
  memberId: idSchema,
  role: z.enum(["moderator", "member"]),
});

export const banSchema = z.object({
  communityId: idSchema,
  memberId: idSchema,
  banned: z.boolean(),
  reason: z.enum(REMOVAL_REASON_VALUES).default("other"),
});

export const removeSchema = z.object({
  id: idSchema,
  reason: z.enum(REMOVAL_REASON_VALUES, { error: "Choose a reason." }),
});

/** A readable, URL-safe slug from a name. The database enforces the same shape. */
export function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : `${base}-community`.replace(/^-/, "");
}

export type DirectoryParams = {
  q: string;
  kind?: CommunityKind;
  visibility?: "public" | "private";
  scope: "all" | "mine";
  page: number;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Filters come from the URL, so unknown values are dropped instead of rejected. */
export function parseDirectoryParams(params: Record<string, string | string[] | undefined>): DirectoryParams {
  const kind = first(params.kind);
  const visibility = first(params.visibility);
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  return {
    q: cleanText(first(params.q), 60),
    kind: (COMMUNITY_KIND_VALUES as string[]).includes(kind ?? "") ? (kind as CommunityKind) : undefined,
    visibility: visibility === "public" || visibility === "private" ? visibility : undefined,
    scope: first(params.scope) === "mine" ? "mine" : "all",
    page: Number.isFinite(page) ? Math.min(Math.max(page, 1), 200) : 1,
  };
}

export type { RemovalReason };
