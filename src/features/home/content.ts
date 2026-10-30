import type { PostCategory } from "@/features/feed/options";

/** Planned work, shown in the right rail. Nothing here is available yet, and the UI says so. */
export const UPCOMING_FEATURES = [
  { title: "Communities", detail: "Topic and discipline spaces to join." },
  { title: "Mentorship matching", detail: "Find and offer guidance." },
  { title: "Careers and internships", detail: "Roles from verified employers." },
] as const;

/** Informational pages for modules that are not built. */
export const FUTURE_MODULES = {
  communities: {
    title: "Communities",
    summary:
      "Discipline and interest communities, local groups and study spaces are planned for Medyra.",
    bullets: [
      "Join spaces for your field, program or region.",
      "Start discussions alongside people at your career stage.",
      "Clear rules, reporting and moderation before spaces open.",
    ],
  },
  mentorship: {
    title: "Mentorship",
    summary:
      "Matching students and early-career members with experienced professionals is planned.",
    bullets: [
      "Members can already say on their profile that they are looking for, or open to offering, mentorship. This is self-reported.",
      "Matching, requests and messaging are not built yet.",
      "Mentors will not be shown as verified until a real verification process exists.",
    ],
  },
  careers: {
    title: "Careers",
    summary:
      "Jobs, internships and employer profiles are planned for a later release.",
    bullets: [
      "Roles and placements from employers and organizations.",
      "Employer verification before listings go live.",
      "Nothing is listed yet.",
    ],
  },
} as const;

export type FutureModuleKey = keyof typeof FUTURE_MODULES;

/** Short helper copy for the categories shown on the home page. */
export const CATEGORY_NOTE: Partial<Record<PostCategory, string>> = {
  professional_advice:
    "Peer perspectives only. Not a substitute for clinical or legal advice.",
  questions: "Never include details that could identify a patient or client.",
};
