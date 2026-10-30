"use client";

import { useRouter } from "next/navigation";
import { PostCard } from "@/features/feed/components/post-card";
import type { FeedPost } from "@/features/feed/types";

/** One post on its own page (the target of saved items and notifications). */
export function PostView({ post }: { post: FeedPost }) {
  const router = useRouter();
  return <PostCard post={post} onDeleted={() => router.replace("/")} />;
}
