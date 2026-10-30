/**
 * Which optional services are configured. Booleans only: this is shown on /api/health, so it
 * must never contain a value, a key, or a URL. Every integration is optional and falls back
 * to "off" when its variables are missing.
 *
 * NEXT_PUBLIC_* variables must be read with a literal `process.env.NEXT_PUBLIC_X` so Next.js can
 * inline them at build time, exactly like the code that actually uses them. Reading them by a
 * computed name would report "off" on hosts where build-time values are not visible at runtime.
 */

const on = (value: string | undefined) => Boolean(value);

export type ServiceStatus = {
  supabase: boolean;
  sentry: boolean;
  upstashRedis: boolean;
  resend: boolean;
  productbridge: boolean;
  pinecone: boolean;
};

export function serviceStatus(): ServiceStatus {
  return {
    supabase:
      on(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      on(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    sentry: on(process.env.NEXT_PUBLIC_SENTRY_DSN),
    upstashRedis:
      on(process.env.UPSTASH_REDIS_REST_URL) &&
      on(process.env.UPSTASH_REDIS_REST_TOKEN),
    resend: on(process.env.RESEND_API_KEY) && on(process.env.EMAIL_FROM),
    productbridge: on(process.env.NEXT_PUBLIC_PRODUCTBRIDGE_ORG_ID),
    pinecone: on(process.env.PINECONE_API_KEY) && on(process.env.PINECONE_INDEX),
  };
}
