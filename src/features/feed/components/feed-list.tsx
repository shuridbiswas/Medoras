"use client";

import { useState, useTransition } from "react";
import { PostCard } from "@/features/feed/components/post-card";
import { loadMorePosts } from "@/features/feed/actions";
import { Button } from "@/components/ui/button";
import type { FeedPage, FeedPost } from "@/features/feed/types";
import type { PostCategory } from "@/features/feed/options";

/**
 * The first page comes from the server. "Load more" asks the server for the next older page
 * using an opaque cursor. The parent re-keys this component whenever the first page changes
 * (new post, edit, delete), so extra pages never go stale or leave a gap.
 */
export function FeedList({
  initial,
  category,
  authorId,
  empty,
}: {
  initial: FeedPage;
  category?: PostCategory;
  authorId?: string;
  empty: React.ReactNode;
}) {
  const [extra, setExtra] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [pending, startTransition] = useTransition();

  const seen = new Set<string>();
  const posts = [...initial.posts, ...extra].filter((p) => {
    if (removed.has(p.id) || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  function loadMore() {
    if (!cursor) return;
    setError(null);
    startTransition(async () => {
      const result = await loadMorePosts({ cursor, category, authorId });
      if (result.ok) {
        setExtra((list) => [...list, ...result.page.posts]);
        setCursor(result.page.nextCursor);
        setAnnouncement(
          `Loaded ${result.page.posts.length} more ${result.page.posts.length === 1 ? "post" : "posts"}.`,
        );
      } else {
        setError(result.error);
      }
    });
  }

  if (posts.length === 0 && !cursor) return <>{empty}</>;

  return (
    <div>
      <ul className="space-y-4" aria-label="Posts">
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard
              post={post}
              onDeleted={(id) =>
                setRemoved((set) => new Set(set).add(id))
              }
            />
          </li>
        ))}
      </ul>

      <div role="status" className="sr-only">
        {announcement}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex justify-center">
        {cursor ? (
          <Button
            type="button"
            variant="outline"
            onClick={loadMore}
            disabled={pending}
            className="h-10 px-6"
          >
            {pending ? "Loading…" : error ? "Try again" : "Load more posts"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            You&apos;re all caught up.
          </p>
        )}
      </div>
    </div>
  );
}
