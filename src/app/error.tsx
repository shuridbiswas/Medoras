"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { LinkButton } from "@/components/ui/link-button";
import { Button } from "@/components/ui/button";

/**
 * Shown when something throws while rendering a page. It keeps the app's layout, offers a retry,
 * and never shows the technical message to members. (global-error.tsx is the last resort for
 * failures in the root layout itself.)
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No-op when Sentry has no DSN. Events are scrubbed before they leave the app.
    Sentry.captureException(error);
  }, [error]);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center px-5 py-16"
    >
      <p className="text-sm font-semibold tracking-widest text-maroon-700">
        SOMETHING WENT WRONG
      </p>
      <h1 className="mt-3 text-3xl font-bold text-maroon-900">
        We couldn&apos;t load this page.
      </h1>
      <p className="mt-3 text-muted-foreground">
        It&apos;s not you. Please try again. If it keeps happening, come back in a few
        minutes. Nothing you wrote has been lost on our side that we know of.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" onClick={reset} className="h-11 px-5">
          Try again
        </Button>
        <LinkButton href="/" variant="outline" className="h-11 px-5">
          Go to home
        </LinkButton>
      </div>
    </main>
  );
}
