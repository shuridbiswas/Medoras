/**
 * The wording members see about what the forums are, what anonymity means and what they are not.
 * Kept in one place so every page says the same true thing. Update it when behaviour changes.
 */

export const FORUM_TAGLINE = "Ask, answer, discover.";

export const FORUM_INTRO =
  "Ask questions about your studies, your methods and the evidence, and learn from how other members think about them. Answers are peer perspectives for education and professional discussion.";

/** Shown on the forum home, the ask page and every question. */
export const EDUCATIONAL_NOTICE = {
  title: "For learning, not for patient care",
  points: [
    "Discussion here is educational and professional: academic questions, techniques, published evidence and non-identifiable scenarios.",
    "It is not a clinical consultation, a diagnosis, or an authoritative patient-specific second opinion, and nothing here replaces the judgment of a qualified professional who knows the person involved.",
    "Never post identifiable patient or client information. That includes names, dates, places, rare details or images that could point to a person. If you see it, report it.",
    "Members are not verified yet, so an answer's author may not hold the credentials they describe. Check claims against published sources.",
  ],
} as const;

export const NOT_CRISIS =
  "The forums are not a crisis service. If you or someone else may be in immediate danger, contact your local emergency number.";

export const CONFIRM_LABEL =
  "I confirm this question contains no identifiable patient or client information, and that it is for education or professional discussion.";

/** What "anonymous" means, in plain words. Used wherever the choice is offered. */
export const ANONYMITY = {
  label: "Post anonymously",
  summary: "Other members will see \"Anonymous member\" instead of your name and profile.",
  detail: [
    "Your name, photo, role and profile link are not shown on the question, answer or reply, and it is not listed in your profile activity, search results or other members' notifications.",
    "Medyra keeps a private record of who wrote it. You use it to edit, delete or accept answers, and the Medyra team can act on the account behind a reported post (a warning, removal or suspension) without being shown who it is.",
    "This is anonymity from other members, not from Medyra. The private record can be disclosed if the law requires it or to prevent serious harm, and it is deleted with your account.",
    "What you write can still identify you: details of your workplace, class, location or a distinctive writing style may be enough for people who know you. Leave those out.",
    "Anonymous posts follow the same guidelines and can be reported like any other.",
  ],
} as const;

export const HOW_IT_WORKS = [
  { title: "Ask", text: "Pick a topic, say what kind of question it is, and ask in general terms." },
  { title: "Answer", text: "Share what you know, cite what you can, and say when you are unsure." },
  { title: "Discover", text: "Vote answers helpful, follow questions, save the ones worth keeping." },
] as const;

export const ANONYMOUS_AUTHOR = "Anonymous member";
