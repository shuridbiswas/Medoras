/**
 * Version of the Terms, Privacy Policy and Community Guidelines that members accept (and that
 * consent_records stores). Bump it whenever any of the three changes in a way members must
 * re-accept. The "-draft" suffix stays until qualified counsel has reviewed and approved them.
 */
export const POLICY_VERSION = "2026-11-draft";

export const POLICY_DOCS = [
  { kind: "terms", label: "Terms of use", href: "/terms" },
  { kind: "privacy", label: "Privacy policy", href: "/privacy" },
  { kind: "community_guidelines", label: "Community guidelines", href: "/community-guidelines" },
] as const;

export type PolicyKind = (typeof POLICY_DOCS)[number]["kind"];

/**
 * Who members contact about their personal information. Set PRIVACY_CONTACT_EMAIL in the
 * environment once the organisation has named a person responsible and a mailbox exists. Until
 * then the pages say plainly that no contact has been set up.
 */
export function privacyContact(env: Record<string, string | undefined> = process.env): { email: string | null } {
  const email = env.PRIVACY_CONTACT_EMAIL?.trim();
  return { email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null };
}
