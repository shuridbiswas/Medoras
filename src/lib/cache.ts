import "server-only";
import { getRedis, redisPrefix } from "@/lib/redis";
import { reportError } from "@/lib/monitoring/report";

/**
 * Short-lived cache in Upstash Redis for data that is the same for every member and not private
 * (for example, public aggregate counts). Rules:
 *  - Always has a TTL; nothing lives in Redis permanently.
 *  - Never use it for anything tied to one member (profiles, feeds, comments, tokens). Those
 *    would need the member id in the key and are not cached at all today.
 *  - Invalidation is by expiry (short TTL). If you ever need instant invalidation, call
 *    `invalidate(key)` from the code that changes the data.
 *  - If Redis is missing or fails, the loader just runs.
 */
const key = (name: string) => `${redisPrefix()}:cache:v1:${name}`;

export async function cached<T>(
  name: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();
  if (!redis) return load();

  try {
    const hit = await redis.get<T>(key(name));
    if (hit !== null && hit !== undefined) return hit;
  } catch (error) {
    reportError("cache-read", error, { name });
    return load();
  }

  const value = await load();
  try {
    await redis.set(key(name), value, { ex: ttlSeconds });
  } catch (error) {
    reportError("cache-write", error, { name });
  }
  return value;
}

export async function invalidate(name: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key(name));
  } catch (error) {
    reportError("cache-invalidate", error, { name });
  }
}
