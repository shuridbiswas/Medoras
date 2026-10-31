import type { MentorFormat } from "@/lib/supabase/database.types";

/** Must match mentor_profiles_formats_valid in supabase/migrations. */
export const MENTOR_FORMATS: readonly { value: MentorFormat; label: string }[] = [
  { value: "video", label: "Video call" },
  { value: "phone", label: "Phone call" },
  { value: "chat", label: "Written chat" },
  { value: "in_person", label: "In person" },
];
export const MENTOR_FORMAT_VALUES = MENTOR_FORMATS.map((f) => f.value) as [MentorFormat, ...MentorFormat[]];
export const formatLabel = (value: string) => MENTOR_FORMATS.find((f) => f.value === value)?.label ?? value;

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const EXPERIENCE_FILTERS = [
  { value: "3", label: "3+ years" },
  { value: "5", label: "5+ years" },
  { value: "10", label: "10+ years" },
  { value: "15", label: "15+ years" },
] as const;

export const MENTOR_PAGE_SIZE = 10;
export const BIO_MAX = 1200;
export const GOALS_MAX = 1500;
export const GOALS_MIN = 20;

export const minutesToTime = (m: number) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const timeToMinutes = (t: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[1]) <= 24 && Number(match[2]) < 60 ? minutes : null;
};

export const STATUS_LABELS = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  ended: "Ended early",
} as const;
