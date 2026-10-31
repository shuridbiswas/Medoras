import { z } from "zod";
import {
  ANSWER_MAX,
  QUESTION_FILTERS,
  QUESTION_KIND_VALUES,
  QUESTION_MAX,
  REPLY_MAX,
  SEARCH_MAX,
  TITLE_MAX,
  TITLE_MIN,
  type QuestionFilter,
  type QuestionKind,
} from "@/features/forums/options";

const body = (max: number, empty: string) =>
  z.string().trim().min(1, empty).max(max, `Use ${max.toLocaleString("en-US")} characters or fewer.`);

export const idSchema = z.uuid();

export const askSchema = z.object({
  topic: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Choose a topic."),
  kind: z.enum(QUESTION_KIND_VALUES, { error: "Choose what kind of question this is." }),
  title: z
    .string()
    .trim()
    .min(TITLE_MIN, `Write a title of at least ${TITLE_MIN} characters.`)
    .max(TITLE_MAX, `Use ${TITLE_MAX} characters or fewer.`),
  body: body(QUESTION_MAX, "Add some detail so people can help."),
  anonymous: z.boolean(),
  confirmed: z.literal(true, { error: "Please confirm the question contains no identifiable information." }),
});

export const answerSchema = z.object({
  questionId: idSchema,
  body: body(ANSWER_MAX, "Write an answer first."),
  anonymous: z.boolean(),
});

export const replySchema = z.object({
  answerId: idSchema,
  body: body(REPLY_MAX, "Write a reply first."),
  anonymous: z.boolean(),
});

export type ListParams = {
  q: string;
  topic?: string;
  kind?: QuestionKind;
  filter: QuestionFilter;
  page: number;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Search text goes to a text-search query as data, but keep it short and free of control characters. */
export function cleanSearch(value: string | undefined): string {
  return (value ?? "")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEARCH_MAX);
}

export function parseListParams(params: Record<string, string | string[] | undefined>, topic?: string): ListParams {
  const kind = first(params.kind);
  const filter = first(params.filter);
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  return {
    q: cleanSearch(first(params.q)),
    topic: topic ?? (first(params.topic)?.match(/^[a-z0-9]+(-[a-z0-9]+)*$/) ? first(params.topic) : undefined),
    kind: (QUESTION_KIND_VALUES as string[]).includes(kind ?? "") ? (kind as QuestionKind) : undefined,
    filter: QUESTION_FILTERS.some((f) => f.value === filter) ? (filter as QuestionFilter) : "all",
    page: Number.isFinite(page) ? Math.min(Math.max(page, 1), 200) : 1,
  };
}
