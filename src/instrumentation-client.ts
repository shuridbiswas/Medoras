import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "@/lib/monitoring/config";

// Browser errors only. Session Replay and the Sentry feedback widget are deliberately NOT
// enabled: replays record what members type and read, which can include sensitive discussion.
Sentry.init({
  ...baseSentryOptions(),
  integrations: [],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
