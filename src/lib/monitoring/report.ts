import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Report an unexpected server-side failure (for example a database error) without leaking
 * member content. Pass only an operation name and a short, non-sensitive code or message
 * from the database client; never pass post text, profile data or request bodies.
 * No-op when Sentry is not configured.
 */
export function reportError(
  operation: string,
  error: unknown,
  tags: Record<string, string> = {},
): void {
  const safe =
    error instanceof Error
      ? error
      : new Error(
          typeof error === "object" && error && "message" in error
            ? String((error as { message: unknown }).message)
            : "Unknown error",
        );
  Sentry.captureException(safe, {
    tags: { operation, ...tags },
    // Only the database error code, if there is one.
    extra:
      typeof error === "object" && error && "code" in error
        ? { code: String((error as { code: unknown }).code) }
        : undefined,
  });
}
