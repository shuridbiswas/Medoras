import { Suspense } from "react";
import { Info } from "lucide-react";
import { AppFrame } from "@/components/layout/app-frame";
import { AppHeader } from "@/components/layout/app-header";
import { LinkButton } from "@/components/ui/link-button";
import { requireMember } from "@/lib/auth/session";
import { FUTURE_MODULES, type FutureModuleKey } from "@/features/home/content";

async function ModuleContent({ module }: { module: FutureModuleKey }) {
  const { profile } = await requireMember();
  const content = FUTURE_MODULES[module];

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <section
          aria-labelledby="module-title"
          className="max-w-2xl rounded-2xl border border-border bg-surface p-6 sm:p-8"
        >
          <p className="inline-flex items-center gap-2 rounded-full bg-maroon-50 px-3 py-1 text-xs font-semibold text-maroon-800">
            <Info className="size-3.5" aria-hidden="true" />
            Not available yet
          </p>
          <h1 id="module-title" className="mt-4 text-2xl font-bold text-maroon-900">
            {content.title}
          </h1>
          <p className="mt-2 leading-relaxed text-maroon-900/85">{content.summary}</p>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-relaxed text-maroon-900/80">
            {content.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <div className="mt-6">
            <LinkButton href="/" className="h-10 px-5">
              Back to home
            </LinkButton>
          </div>
        </section>
      </main>
    </>
  );
}

/** Informational page for a module that is planned but not built. */
export function ModulePage({ module }: { module: FutureModuleKey }) {
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
        <ModuleContent module={module} />
      </Suspense>
    </AppFrame>
  );
}
