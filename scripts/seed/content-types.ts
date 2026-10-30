/** Shape shared by the French and English text corpora. Everything here is fictional test text. */

export const THEMES = [
  "placement",
  "oiiq",
  "psygrad",
  "cegep",
  "swintern",
  "bedside",
  "pharm",
  "mentor",
  "mcgillres",
  "workstudy",
  "physio",
  "hospra",
] as const;
export type Theme = (typeof THEMES)[number];

export type ThemeText = {
  /** Situations: how a post starts (first person, no identifying detail). */
  s: string[];
  /** Details or tips. */
  d: string[];
  /** Closing reflections. */
  c: string[];
  /** Questions for the community. */
  q: string[];
  /** Replies to a post on this theme. */
  r: string[];
};

export type Corpus = {
  themes: Record<Theme, ThemeText>;
  /** Replies that fit any post. */
  replies: string[];
  /** Short openers and closers added to replies. */
  openers: string[];
  endings: string[];
  /** One-line casual posts. */
  casual: string[];
  /** Extra closing sentences usable on any theme. */
  generalClosers: string[];
  /** Sentences for the very long post. */
  longform: string[];
  /** Posts with markup characters, quotes, ampersands and emoji, and their category. */
  escaping: { category: string; body: string }[];
  skills: Record<string, string[]>;
  interests: string[];
  mentorship: string[];
};
