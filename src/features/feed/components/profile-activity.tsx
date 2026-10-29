import { Suspense } from "react";
import { FeedSection } from "@/features/feed/components/feed-section";
import { FeedSkeleton } from "@/features/feed/components/feed-skeleton";

/** A member's own posts, newest first, for the Activity tab of their profile. */
export function ProfileActivity({
  viewerId,
  authorId,
  isOwner,
  firstName,
}: {
  viewerId: string;
  authorId: string;
  isOwner: boolean;
  firstName: string;
}) {
  return (
    <Suspense fallback={<FeedSkeleton count={2} />}>
      <FeedSection
        viewerId={viewerId}
        authorId={authorId}
        retryHref="/home"
        emptyTitle="No posts yet"
        emptyDescription={
          isOwner
            ? "Share something from your home page and it will appear here."
            : `${firstName} hasn't posted yet.`
        }
      />
    </Suspense>
  );
}
