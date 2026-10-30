import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { FeedList } from "@/features/feed/components/feed-list";
import { getFeedPage } from "@/features/feed/queries";
import type { PostCategory } from "@/features/feed/options";
import { MessagesSquare } from "lucide-react";

/** Loads the first page on the server and hands it to the client list for "Load more". */
export async function FeedSection({
  viewerId,
  category,
  authorId,
  scope,
  emptyTitle,
  emptyDescription,
  retryHref,
}: {
  viewerId: string;
  category?: PostCategory;
  authorId?: string;
  scope?: "following";
  emptyTitle: string;
  emptyDescription: string;
  retryHref: string;
}) {
  const page = await getFeedPage(viewerId, { category, authorId, scope });

  if (page.failed) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive"
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          We couldn&apos;t load posts right now.{" "}
          <Link href={retryHref} className="font-medium underline underline-offset-2">
            Try again
          </Link>
        </p>
      </div>
    );
  }

  // The key changes whenever the first page changes, which resets any "load more" pages.
  const key = page.posts.map((p) => `${p.id}:${p.edited_at ?? ""}`).join(",");

  return (
    <FeedList
      key={key}
      initial={{ posts: page.posts, nextCursor: page.nextCursor }}
      category={category}
      authorId={authorId}
      scope={scope}
      empty={
        <EmptyState
          icon={MessagesSquare}
          title={emptyTitle}
          description={emptyDescription}
        />
      }
    />
  );
}
