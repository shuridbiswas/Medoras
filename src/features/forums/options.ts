/** Must match forum_questions_kind_valid in supabase/migrations. */
export const QUESTION_KINDS = [
  { value: "academic", label: "Academic question", hint: "Concepts, coursework, exams and how things work." },
  { value: "technique", label: "Technique or method", hint: "How practitioners approach a method, discussed in general terms." },
  { value: "evidence", label: "Published evidence", hint: "A paper, guideline or study: what it says and how to read it." },
  { value: "scenario", label: "Non-identifiable scenario", hint: "A de-identified, hypothetical or composite situation, for learning." },
  { value: "career", label: "Career or training", hint: "Pathways, placements, supervision and working life." },
  { value: "other", label: "Something else", hint: "Anything that does not fit another kind." },
] as const;

export type QuestionKind = (typeof QUESTION_KINDS)[number]["value"];
export const QUESTION_KIND_VALUES = QUESTION_KINDS.map((k) => k.value) as [QuestionKind, ...QuestionKind[]];
export const kindLabel = (value: string) => QUESTION_KINDS.find((k) => k.value === value)?.label ?? "Question";

export const TITLE_MIN = 10;
export const TITLE_MAX = 150;
export const QUESTION_MAX = 5000;
export const ANSWER_MAX = 5000;
export const REPLY_MAX = 1000;
export const FORUM_PAGE_SIZE = 15;
export const SEARCH_MAX = 80;

export const QUESTION_FILTERS = [
  { value: "all", label: "Newest" },
  { value: "open", label: "No accepted answer" },
  { value: "following", label: "Following" },
  { value: "mine", label: "My questions" },
] as const;
export type QuestionFilter = (typeof QUESTION_FILTERS)[number]["value"];
