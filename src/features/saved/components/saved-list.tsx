"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PostCard } from "@/features/feed/components/post-card";
import type { FeedPost } from "@/features/feed/types";

/**
 * The viewer's saved posts. Removing a save (or deleting your own post) takes the card out of the
 * list right away; the server already did the work, so nothing here can drift.
 */
export function SavedList({ posts }: { posts: FeedPost[] }) {
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const visible = posts.filter((p) => !removed.has(p.id));
  const remove = (id: string) => setRemoved((set) => new Set(set).add(id));

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="Nothing saved here"
        description="Use the bookmark on any post to keep it for later. Only you can see what you save."
        action={{ href: "/", label: "Browse the feed" }}
      />
    );
  }

  return (
    <ul aria-label="Saved posts" className="space-y-4">
      {visible.map((post) => (
        <li key={post.id}>
          <PostCard post={post} onDeleted={remove} onUnsaved={remove} />
        </li>
      ))}
    </ul>
  );
}
