/** Must match the posts_category_valid CHECK constraint in supabase/migrations. */
export const POST_CATEGORIES = [
  {
    value: "general_discussion",
    label: "General Discussion",
    hint: "Open conversation across healthcare and social services.",
  },
  {
    value: "academic_life",
    label: "Academic Life",
    hint: "Coursework, placements, exams and student life.",
  },
  {
    value: "career_journey",
    label: "Career Journey",
    hint: "Where you are heading, and how you got here.",
  },
  {
    value: "professional_advice",
    label: "Professional Advice",
    hint: "Peer perspectives on working life. Not clinical advice.",
  },
  {
    value: "research_knowledge",
    label: "Research and Knowledge",
    hint: "Papers, methods and things worth learning.",
  },
  {
    value: "personal_achievement",
    label: "Personal Achievement",
    hint: "Milestones, big or small.",
  },
  {
    value: "questions",
    label: "Questions",
    hint: "Ask the community. Never share patient details.",
  },
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number]["value"];

export const POST_CATEGORY_VALUES = POST_CATEGORIES.map((c) => c.value) as [
  PostCategory,
  ...PostCategory[],
];

export const categoryLabel = (value: string) =>
  POST_CATEGORIES.find((c) => c.value === value)?.label ?? "Discussion";

export const POST_MAX_LENGTH = 3000;
export const COMMENT_MAX_LENGTH = 1000;
export const FEED_PAGE_SIZE = 15;
export const COMMENT_PAGE_LIMIT = 100;
