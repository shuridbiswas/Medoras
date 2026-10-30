import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getMemberStatus, requireMember } from "@/lib/auth/session";
import { signOut } from "@/features/auth/actions";
import { ModerationNotices } from "@/features/safety/components/notices";
import { listMyNotices } from "@/features/safety/queries";

export const metadata: Metadata = {
  title: "Account suspended",
  robots: { index: false },
};

export default function SuspendedPage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-5 py-10">
      <Logo />
      <Suspense fallback={<p role="status">Loading…</p>}>
        <SuspendedContent />
      </Suspense>
    </main>
  );
}

async function SuspendedContent() {
  // A suspended member can still sign in to read the notice and appeal; nothing else.
  const { user } = await requireMember({ allowSuspended: true });
  if ((await getMemberStatus(user.id)) !== "suspended") redirect("/");
  const notices = await listMyNotices(user.id);

  return (
    <>
      <div className="flex gap-3 rounded-2xl border border-maroon-200 bg-maroon-50 p-5">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-maroon-700" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold text-maroon-900">Your account is suspended</h1>
          <p className="mt-1 text-sm text-maroon-900/85">
            While it is suspended you can&apos;t post, comment, connect or use the rest of Medyra. Your posts and
            profile stay as they were unless a decision below says otherwise. You can read the decision and appeal
            it; a person will review your appeal.
          </p>
        </div>
      </div>
      <ModerationNotices notices={notices} />
      <form action={signOut}>
        <Button type="submit" variant="outline" className="h-10 px-4">
          Sign out
        </Button>
      </form>
    </>
  );
}
