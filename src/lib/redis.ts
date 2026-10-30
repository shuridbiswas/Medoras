import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Upstash Redis over its REST API (works on Netlify Functions; no persistent connection).
 * Official variable names: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 * Returns null when they are missing, and every caller must then carry on without Redis.
 * Redis is only for rate limits and short-lived caches; PostgreSQL stays the source of truth.
 */
let client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

/** For tests. */
export function resetRedisForTests() {
  client = undefined;
}

/** Prefix keeps environments (and apps) apart if they ever share a Redis database. */
export const redisPrefix = () =>
  `medyra:${process.env.NEXT_PUBLIC_APP_ENV ?? process.env.CONTEXT ?? process.env.NODE_ENV ?? "dev"}`;
