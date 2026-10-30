import Link from "next/link";
import { UserX } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { Logo } from "@/components/brand/logo";

export default function ProfileNotFound() {
  return (
    <div className="min-h-dvh bg-sand/60">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
          <Logo />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          icon={UserX}
          title="We couldn't find that profile"
          description="The username may be misspelled, or the member hasn't finished setting up their profile yet."
        />
        <p className="mt-6 text-center text-sm">
          <Link
            href="/"
            className="font-semibold text-maroon-700 underline-offset-4 hover:underline"
          >
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
