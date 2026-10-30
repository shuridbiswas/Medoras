import { z } from "zod";
import { FIELDS } from "@/features/onboarding/options";
import {
  DIRECTORY_PAGE_SIZE,
  MEMBER_GROUPS,
  MENTORSHIP_FILTERS,
} from "@/features/network/options";

export const memberIdSchema = z.uuid("That member is not valid.");
export const connectionIdSchema = z.uuid("That request is not valid.");

/** Remove characters with meaning in PostgREST filters or LIKE patterns; keep it short. */
export function cleanText(value: string | undefined, max = 60): string {
  return (value ?? "")
    .replace(/[%_,()\\*"'.:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Name terms: every term must match (up to three). */
export function nameTerms(q: string | undefined): string[] {
  return cleanText(q, 90)
    .split(" ")
    .filter(Boolean)
    .map((t) => t.slice(0, 30))
    .slice(0, 3);
}

const FIELD_VALUES = FIELDS.map((f) => f.value) as [string, ...string[]];
const GROUP_VALUES = MEMBER_GROUPS.map((g) => g.value) as [string, ...string[]];
const MENTORSHIP_VALUES = MENTORSHIP_FILTERS.map((m) => m.value) as [
  string,
  ...string[],
];

export type DirectoryFilters = {
  q: string;
  group?: (typeof MEMBER_GROUPS)[number]["value"];
  field?: string;
  institution: string;
  country?: string;
  region: string;
  mentorship?: (typeof MENTORSHIP_FILTERS)[number]["value"];
  page: number;
};

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

const optionalEnum = (values: [string, ...string[]], v: string | undefined) =>
  v && (values as string[]).includes(v) ? v : undefined;

/**
 * Directory filters come from the URL, so anything unknown is dropped rather than rejected: a
 * stale link still opens the directory.
 */
export function parseDirectoryParams(
  params: Record<string, string | string[] | undefined>,
): DirectoryFilters {
  const country = first(params.country);
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  return {
    q: cleanText(first(params.q)),
    group: optionalEnum(GROUP_VALUES, first(params.group)) as DirectoryFilters["group"],
    field: optionalEnum(FIELD_VALUES, first(params.field)),
    institution: cleanText(first(params.institution)),
    country: country && /^[A-Z]{2}$/.test(country) ? country : undefined,
    region: cleanText(first(params.region)),
    mentorship: optionalEnum(
      MENTORSHIP_VALUES,
      first(params.mentorship),
    ) as DirectoryFilters["mentorship"],
    page: Number.isFinite(page) ? Math.min(Math.max(page, 1), 500) : 1,
  };
}

export const hasActiveFilters = (f: DirectoryFilters) =>
  Boolean(
    f.q || f.group || f.field || f.institution || f.country || f.region || f.mentorship,
  );

export const pageRange = (page: number, size = DIRECTORY_PAGE_SIZE) => ({
  from: (page - 1) * size,
  to: page * size - 1,
});
