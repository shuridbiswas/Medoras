import type { ErrorEvent, EventHint } from "@sentry/nextjs";
import { scrubEvent } from "@/lib/monitoring/scrub";

/**
 * Shared Sentry options. The DSN is a public identifier (it is safe in the browser), but the SDK
 * only starts when one is set, so Sentry stays fully optional.
 */

export const sentryDsn = () => process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;

export const sentryEnvironment = () =>
  process.env.NEXT_PUBLIC_APP_ENV ||
  process.env.CONTEXT || // Netlify: production | deploy-preview | branch-deploy
  process.env.NODE_ENV ||
  "development";

const isProduction = () => sentryEnvironment() === "production";

export function baseSentryOptions() {
  return {
    dsn: sentryDsn(),
    environment: sentryEnvironment(),
    enabled: Boolean(sentryDsn()),
    // Sentry v11 data collection: no user info, cookies, headers, request bodies or query strings
    // are attached automatically. scrubEvent() below removes anything that slips through.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    // Performance sampling: light in production, fuller elsewhere.
    tracesSampleRate: isProduction() ? 0.1 : 1.0,
    beforeSend: (event: ErrorEvent, hint: EventHint) => scrubEvent(event, hint),
  };
}
