import type { CommunityKind, CommunityVisibility } from "@/lib/supabase/database.types";

/** Must match communities_kind_valid in supabase/migrations. */
export const COMMUNITY_KINDS: readonly { value: CommunityKind; label: string; hint: string }[] = [
  { value: "profession", label: "Profession", hint: "Nursing, social work, pharmacy, physiotherapy and other professions." },
  { value: "institution", label: "Institution", hint: "A school, hospital, agency or professional body." },
  { value: "research", label: "Research", hint: "A research area, lab, journal club or methods group." },
  { value: "regional", label: "Regional", hint: "Members in a region who want local conversation." },
  { value: "interest", label: "Interest", hint: "A shared interest that does not fit the others." },
];

export const COMMUNITY_KIND_VALUES = COMMUNITY_KINDS.map((k) => k.value) as [CommunityKind, ...CommunityKind[]];
export const kindLabel = (value: string) => COMMUNITY_KINDS.find((k) => k.value === value)?.label ?? "Community";

export const VISIBILITIES: readonly { value: CommunityVisibility; label: string; hint: string }[] = [
  {
    value: "public",
    label: "Public",
    hint: "Any Medyra member can read posts and the member list, and join straight away.",
  },
  {
    value: "private",
    label: "Private",
    hint: "The name, description and rules are listed so people can find it, but posts, announcements and the member list are visible to members only. A moderator approves each request to join.",
  },
];

/** Must match community_bans_reason_valid. Used for removals, bans and the audit log. */
export const REMOVAL_REASONS = [
  { value: "rules", label: "Breaks the community rules" },
  { value: "spam", label: "Spam or advertising" },
  { value: "harassment", label: "Harassment or disrespect" },
  { value: "privacy", label: "Identifiable patient or personal information" },
  { value: "off_topic", label: "Off topic" },
  { value: "other", label: "Something else" },
] as const;

export type RemovalReason = (typeof REMOVAL_REASONS)[number]["value"];
export const REMOVAL_REASON_VALUES = REMOVAL_REASONS.map((r) => r.value) as [RemovalReason, ...RemovalReason[]];
export const removalReasonLabel = (value: string) => REMOVAL_REASONS.find((r) => r.value === value)?.label ?? value;

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "request.approve": "Approved a request to join",
  "request.reject": "Declined a request to join",
  "role.moderator": "Made a member a moderator",
  "role.member": "Returned a moderator to member",
  "member.remove": "Removed a member",
  "member.restore": "Allowed a removed member to rejoin",
  "post.remove": "Removed a post",
  "comment.remove": "Removed a comment",
  "announcement.create": "Published an announcement",
  "announcement.delete": "Removed an announcement",
};

export const ROLE_LABELS = { owner: "Owner", moderator: "Moderator", member: "Member" } as const;

export const COMMUNITY_PAGE_SIZE = 12;
export const MEMBERS_PAGE_SIZE = 30;
export const AUDIT_PAGE_SIZE = 25;
export const RULES_MAX = 3000;
