/**
 * ProductBridge (product feedback portal, roadmap, changelog).
 *
 * Integration method: the documented "Direct URL" pattern
 *   https://app.productbridge.io/widget/<ORGANIZATION_ID>?tab=feedback|roadmap|changelog
 * (docs.productbridge.io > Widgets & Embeds > Direct URL). The organization id comes from
 * ProductBridge: Settings > Connect > Widget & Embeds. It is a public identifier, so it may live
 * in NEXT_PUBLIC_PRODUCTBRIDGE_ORG_ID.
 *
 * Deliberately NOT done: no widget script on every page, no identify()/JWT calls, no API calls.
 * Medyra sends ProductBridge nothing about the member, so profile data, clinical details and
 * private discussion never leave the app through this integration. (An embedded widget with
 * verified identities is a documented option; see DEPLOYMENT.md before enabling it.)
 */

const ORG_ID = /^[A-Za-z0-9_-]{4,80}$/;

export type FeedbackLinks = {
  feedback: string;
  roadmap: string;
  changelog: string;
};

export function productbridgeLinks(
  orgId: string | undefined = process.env.NEXT_PUBLIC_PRODUCTBRIDGE_ORG_ID,
): FeedbackLinks | null {
  if (!orgId || !ORG_ID.test(orgId)) return null;
  const base = `https://app.productbridge.io/widget/${encodeURIComponent(orgId)}`;
  return {
    feedback: `${base}?tab=feedback`,
    roadmap: `${base}?tab=roadmap`,
    changelog: `${base}?tab=changelog`,
  };
}
