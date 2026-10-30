import type { Metadata } from "next";
import { Suspense } from "react";
import { AppFrame } from "@/components/layout/app-frame";
import { AppHeader } from "@/components/layout/app-header";
import { requireMember } from "@/lib/auth/session";
import { productbridgeLinks } from "@/features/feedback/config";
import { FeedbackPanel } from "@/features/feedback/components/feedback-panel";

export const metadata: Metadata = {
  title: "Feedback",
  robots: { index: false },
};

export default function FeedbackPage() {
  return (
    <AppFrame>
      <Suspense
        fallback={
          <div role="status" className="flex min-h-dvh items-center justify-center">
            <span className="size-8 animate-spin rounded-full border-2 border-maroon-200 border-t-maroon-700 motion-reduce:animate-none" />
            <span className="sr-only">Loading</span>
          </div>
        }
      >
        <FeedbackContent />
      </Suspense>
    </AppFrame>
  );
}

async function FeedbackContent() {
  const { profile } = await requireMember();
  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-maroon-900">Help shape Medyra</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Medyra is new and your ideas matter. Tell us what would help you connect,
            learn and grow.
          </p>
        </div>
        <FeedbackPanel links={productbridgeLinks()} />
      </main>
    </>
  );
}
