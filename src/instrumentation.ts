import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "@/lib/monitoring/config";

export async function register() {
  // Node.js runtime only: Medyra has no Edge routes (proxy.ts runs on Node in Next 16).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init(baseSentryOptions());
  }
}

// Reports errors from Server Components, Route Handlers, Server Actions and the proxy.
export const onRequestError = Sentry.captureRequestError;
