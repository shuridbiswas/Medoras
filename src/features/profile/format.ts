import {
  CAREER_STAGES,
  EMPLOYMENT_TYPES,
  FIELDS,
  MEMBER_TYPES,
} from "@/features/onboarding/options";

type Option = { value: string; label: string };

export const labelOf = (
  options: readonly Option[],
  value: string | null | undefined,
) => options.find((o) => o.value === value)?.label ?? null;

export const memberTypeLabel = (v: string | null) => labelOf(MEMBER_TYPES, v);
export const careerStageLabel = (v: string | null) => labelOf(CAREER_STAGES, v);
export const employmentTypeLabel = (v: string | null) =>
  labelOf(EMPLOYMENT_TYPES, v);
export const fieldLabels = (values: string[]) =>
  values.map((v) => labelOf(FIELDS, v)).filter((l): l is string => Boolean(l));

export function countryName(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2024-05-01" -> "May 2024" without any timezone conversion. */
export function formatMonth(date: string | null): string | null {
  if (!date) return null;
  const [year, month] = date.split("-");
  const name = MONTHS[Number(month) - 1];
  return name ? `${name} ${year}` : year;
}

export function formatMonthRange(
  start: string,
  end: string | null,
  current: boolean,
): string {
  const from = formatMonth(start);
  const to = current ? "Present" : formatMonth(end);
  return to ? `${from} to ${to}` : `${from}`;
}

export function formatYearRange(
  start: number | null,
  end: number | null,
  current: boolean,
): string | null {
  if (!start && !end && !current) return null;
  const to = current ? "Present" : end;
  if (start && to) return `${start} to ${to}`;
  if (start) return `${start}`;
  return to ? `${to}` : null;
}

/** Location the member chose to show, plus their country. Never anything more precise. */
export function generalLocation(
  label: string | null,
  country: string | null,
): string | null {
  const place = countryName(country);
  if (label && place && !label.toLowerCase().includes(place.toLowerCase())) {
    return `${label}, ${place}`;
  }
  return label ?? place;
}
