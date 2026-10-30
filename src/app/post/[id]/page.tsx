import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { requireMember } from "@/lib/auth/session";
import { idSchema } from "@/features/feed/schemas";
import { getPostsByIds } from "@/features/feed/queries";
import { PostView } from "@/features/saved/components/post-view";

export const metadata: Metadata = {
  title: "Post",
  robots: { index: false },
};

type Props = { params: Promise<{ id: string }> };

export default function PostPage({ params }: Props) {
  return (
    <AppPage label="the post">
      <PostContent params={params} />
    </AppPage>
  );
}

async function PostContent({ params }: Props) {
  const { id } = await params;
  const { user, profile } = await requireMember();
  // Malformed ids and posts the viewer cannot see are both "not found".
  if (!idSchema.safeParse(id).success) notFound();
  const { posts } = await getPostsByIds(user.id, [id]);
  const post = posts[0];
  if (!post) notFound();

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-maroon-700 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to home
        </Link>
        <PostView post={post} />
      </main>
    </>
  );
}
