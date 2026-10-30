/**
 * Which optional services are configured. Booleans only: this is shown on /api/health, so it
 * must never contain a value, a key, or a URL. Every integration is optional and falls back
 * to "off" when its variables are missing.
 */

const has = (...names: string[]) => names.every((n) => Boolean(process.env[n]));

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
    supabase: has("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    sentry: has("NEXT_PUBLIC_SENTRY_DSN"),
    upstashRedis: has("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"),
    resend: has("RESEND_API_KEY", "EMAIL_FROM"),
    productbridge: has("NEXT_PUBLIC_PRODUCTBRIDGE_ORG_ID"),
    pinecone: has("PINECONE_API_KEY", "PINECONE_INDEX"),
  };
}
