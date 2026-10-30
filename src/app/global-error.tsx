"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Last-resort error screen. Reports to Sentry when it is configured; otherwise just renders. */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          minHeight: "100vh",
          placeItems: "center",
          margin: 0,
          background: "#fbf7f7",
          color: "#3b0a17",
        }}
      >
        <main style={{ maxWidth: 440, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ lineHeight: 1.5 }}>
            Medyra hit an unexpected problem. Please reload the page. If it keeps
            happening, try again in a few minutes.
          </p>
          {/* A plain anchor on purpose: the app shell (and its router) failed to render. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ color: "#8b1d38", fontWeight: 600 }}>
            Back to the start
          </a>
        </main>
      </body>
    </html>
  );
}
