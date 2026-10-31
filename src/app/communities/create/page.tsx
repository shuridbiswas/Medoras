import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { requireMember } from "@/lib/auth/session";
import { CommunityForm } from "@/features/communities/components/community-form";

export const metadata: Metadata = {
  title: "Create a community",
  robots: { index: false },
};

export default function CreateCommunityPage() {
  return (
    <AppPage label="the form">
      <CreateContent />
    </AppPage>
  );
}

async function CreateContent() {
  const { profile } = await requireMember();
  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
        <Link href="/communities" className="inline-flex items-center gap-1.5 text-sm font-medium text-maroon-700 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to communities
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-maroon-900">Create a community</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Start a space for a profession, an institution, a research area or a region. You can create up to three a day.
          </p>
        </div>
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <CommunityForm />
        </section>
      </main>
    </>
  );
}
