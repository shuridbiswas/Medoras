import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Lock, MapPin, Megaphone, ScrollText, Users } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { RelativeTime } from "@/components/relative-time";
import { chipClass } from "@/components/forms/controls";
import { avatarUrl } from "@/lib/storage-url";
import { requireMember } from "@/lib/auth/session";
import { PostComposer } from "@/features/feed/components/post-composer";
import { FeedSection } from "@/features/feed/components/feed-section";
import { SafetyNotice } from "@/features/feed/components/safety-notice";
import { ReportButton } from "@/features/safety/components/report-button";
import { countryName } from "@/features/profile/format";
import { JoinPanel } from "@/features/communities/components/join-panel";
import { AnnouncementForm, DeleteAnnouncementButton } from "@/features/communities/components/staff-controls";
import { kindLabel, ROLE_LABELS } from "@/features/communities/options";
import { getCommunityBySlug, listAnnouncements } from "@/features/communities/queries";
import { personName } from "@/features/admin/queries";

export const metadata: Metadata = {
  title: "Community",
  robots: { index: false },
};

type Props = { params: Promise<{ slug: string }> };

export default function CommunityPage({ params }: Props) {
  return (
    <AppPage label="the community">
      <CommunityContent params={params} />
    </AppPage>
  );
}

async function CommunityContent({ params }: Props) {
  const { slug } = await params;
  const { user, profile } = await requireMember();
  const community = await getCommunityBySlug(user.id, slug);
  if (!community) notFound();

  const isMember = community.role !== null;
  const isStaff = community.role === "owner" || community.role === "moderator";
  const canRead = community.visibility === "public" || isMember;
  const announcements = canRead ? await listAnnouncements(community.id) : [];
  const place = [community.region_label, community.country ? countryName(community.country) : null].filter(Boolean).join(", ");

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <Link href="/communities" className="inline-flex items-center gap-1.5 text-sm font-medium text-maroon-700 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          All communities
        </Link>

        <header className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className={chipClass}>{kindLabel(community.kind)}</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {community.visibility === "private" ? (
                <>
                  <Lock className="size-3.5" aria-hidden="true" /> Private
                </>
              ) : (
                <>
                  <Globe className="size-3.5" aria-hidden="true" /> Public
                </>
              )}
            </span>
            {community.role ? (
              <span className="rounded-full border border-maroon-200 px-2 py-0.5 text-xs font-medium text-maroon-700">
                You are {community.role === "member" ? "a member" : `the ${ROLE_LABELS[community.role].toLowerCase()}`}
              </span>
            ) : null}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-maroon-900">{community.name}</h1>
            <p className="mt-2 leading-relaxed whitespace-pre-wrap text-maroon-900/90">{community.description}</p>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {community.memberCount !== null ? (
              <li className="flex items-center gap-1.5">
                <Users className="size-4 text-maroon-600" aria-hidden="true" />
                <Link href={`/communities/${community.slug}/members`} className="hover:text-maroon-900 hover:underline">
                  {community.memberCount} {community.memberCount === 1 ? "member" : "members"}
                </Link>
              </li>
            ) : null}
            {community.institution ? <li>{community.institution}</li> : null}
            {place ? (
              <li className="flex items-center gap-1.5">
                <MapPin className="size-4 text-maroon-600" aria-hidden="true" />
                {place}
              </li>
            ) : null}
          </ul>
          <JoinPanel communityId={community.id} visibility={community.visibility} role={community.role} requestPending={community.requestPending} />
          <div className="flex flex-wrap items-center gap-x-4 border-t border-border pt-3">
            {canRead ? (
              <Link href={`/communities/${community.slug}/members`} className="text-sm font-medium text-maroon-700 hover:underline">
                {isStaff ? "Members and moderation" : "Members"}
              </Link>
            ) : null}
            {!isStaff ? <ReportButton targetType="community" targetId={community.id} label="Report this community" /> : null}
          </div>
        </header>

        {community.rules ? (
          <section aria-labelledby="rules-heading" className="rounded-2xl border border-border bg-surface p-5">
            <h2 id="rules-heading" className="flex items-center gap-2 text-base font-semibold text-maroon-900">
              <ScrollText className="size-4 text-maroon-600" aria-hidden="true" />
              Community rules
            </h2>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-maroon-900/90">{community.rules}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              These rules are set by the community&apos;s owner. The{" "}
              <Link href="/community-guidelines" className="underline underline-offset-2">
                Medyra community guidelines
              </Link>{" "}
              always apply as well.
            </p>
          </section>
        ) : null}

        {!canRead ? (
          <section aria-labelledby="private-heading" className="rounded-2xl border border-dashed border-maroon-200 bg-maroon-50/60 p-6 text-center">
            <Lock className="mx-auto size-5 text-maroon-700" aria-hidden="true" />
            <h2 id="private-heading" className="mt-2 text-base font-semibold text-maroon-900">
              This community is private
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Posts, announcements and the member list are only visible to members. Ask to join and a moderator will review your
              request.
            </p>
          </section>
        ) : (
          <>
            {announcements.length > 0 || isStaff ? (
              <section aria-labelledby="announcements-heading" className="space-y-3 rounded-2xl border border-border bg-surface p-5">
                <h2 id="announcements-heading" className="flex items-center gap-2 text-base font-semibold text-maroon-900">
                  <Megaphone className="size-4 text-maroon-600" aria-hidden="true" />
                  Announcements
                </h2>
                {announcements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No announcements yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {announcements.map((a) => (
                      <li key={a.id} className="rounded-xl bg-sand/60 p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-maroon-900">{a.title}</h3>
                          {isStaff ? <DeleteAnnouncementButton announcementId={a.id} title={a.title} /> : null}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-maroon-900/90">{a.body}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {a.author ? personName(a.author) : "A former moderator"} · <RelativeTime iso={a.created_at} />
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {isStaff ? (
                  <details className="rounded-xl border border-border p-3.5">
                    <summary className="cursor-pointer text-sm font-medium text-maroon-700">Publish an announcement</summary>
                    <div className="mt-3">
                      <AnnouncementForm communityId={community.id} />
                    </div>
                  </details>
                ) : null}
              </section>
            ) : null}

            <section aria-labelledby="posts-heading" className="space-y-4">
              <h2 id="posts-heading" className="text-lg font-semibold text-maroon-900">
                Posts
              </h2>
              {isMember ? (
                <PostComposer name={profile.first_name} avatarSrc={avatarUrl(profile.avatar_path)} communityId={community.id} />
              ) : (
                <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
                  Join this community to post. Public posts here can be read by every Medyra member.
                </p>
              )}
              <FeedSection
                viewerId={user.id}
                communityId={community.id}
                moderatorOfCommunity={isStaff}
                emptyTitle="No posts yet"
                emptyDescription={isMember ? "Start the conversation with the first post." : "Posts from members will appear here."}
                retryHref={`/communities/${community.slug}`}
              />
              <SafetyNotice />
            </section>
          </>
        )}
      </main>
    </>
  );
}
