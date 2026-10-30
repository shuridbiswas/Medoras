/** Directory filters. Groups map onto the onboarding member types (and the profiles CHECK values). */
export const MEMBER_GROUPS = [
  {
    value: "student",
    label: "Students",
    types: ["undergraduate_student", "graduate_student", "recent_graduate"],
  },
  {
    value: "professional",
    label: "Professionals",
    types: ["healthcare_professional", "social_services_professional", "educator"],
  },
  { value: "researcher", label: "Researchers", types: ["researcher"] },
] as const;

export type MemberGroup = (typeof MEMBER_GROUPS)[number]["value"];

export const MENTORSHIP_FILTERS = [
  { value: "offering", label: "Open to mentoring" },
  { value: "seeking", label: "Looking for a mentor" },
] as const;

export type MentorshipFilter = (typeof MENTORSHIP_FILTERS)[number]["value"];

export const DIRECTORY_PAGE_SIZE = 12;
export const REQUESTS_PAGE_SIZE = 30;
export const CONNECTIONS_PAGE_SIZE = 24;
