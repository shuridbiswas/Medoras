// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.fn();
const getMock = vi.fn();
const setMock = vi.fn();
const delMock = vi.fn();
const slidingWindow = vi.fn((limit: number, window: string) => ({ limit, window }));
const ratelimitCtor = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(public config: unknown) {}
    get = getMock;
    set = setMock;
    del = delMock;
  },
}));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = slidingWindow;
    constructor(options: unknown) {
      ratelimitCtor(options);
    }
    limit = limitMock;
  },
}));

const { checkRateLimit, resetRateLimitersForTests, RATE_LIMIT_POLICIES } = await import(
  "@/lib/rate-limit"
);
const { resetRedisForTests } = await import("@/lib/redis");
const { cached, invalidate } = await import("@/lib/cache");

function configureRedis() {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRedisForTests();
  resetRateLimitersForTests();
});
afterEach(() => vi.unstubAllEnvs());

describe("rate limiting", () => {
  it("allows everything (and says it did not enforce) when Redis is not configured", async () => {
    expect(await checkRateLimit("post", "u1")).toEqual({ ok: true, enforced: false });
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("allows a request under the limit", async () => {
    configureRedis();
    limitMock.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
    expect(await checkRateLimit("post", "u1")).toEqual({ ok: true, enforced: true });
    expect(limitMock).toHaveBeenCalledWith("u1");
  });

  it("blocks over the limit with a retry time and a friendly message", async () => {
    configureRedis();
    limitMock.mockResolvedValue({ success: false, reset: Date.now() + 42_000 });
    const result = await checkRateLimit("comment", "u1");
    expect(result).toMatchObject({ ok: false, message: RATE_LIMIT_POLICIES.comment.message });
    if (!result.ok) expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(41);
  });

  it("fails open when Redis errors, so members are never locked out by an optional service", async () => {
    configureRedis();
    limitMock.mockRejectedValue(new Error("redis down"));
    expect(await checkRateLimit("post", "u1")).toEqual({ ok: true, enforced: false });
  });

  it("builds one sliding-window limiter per policy with an environment-scoped prefix", async () => {
    configureRedis();
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
    limitMock.mockResolvedValue({ success: true, reset: Date.now() });
    await checkRateLimit("search", "u1");
    await checkRateLimit("search", "u2");
    expect(ratelimitCtor).toHaveBeenCalledTimes(1);
    expect(ratelimitCtor.mock.calls[0][0]).toMatchObject({
      prefix: "medyra:preview:rl:search",
    });
    expect(slidingWindow).toHaveBeenCalledWith(
      RATE_LIMIT_POLICIES.search.limit,
      RATE_LIMIT_POLICIES.search.window,
    );
  });

  it("has sensible limits for posts, comments, likes, search and email", () => {
    expect(RATE_LIMIT_POLICIES.post.limit).toBeLessThanOrEqual(20);
    expect(RATE_LIMIT_POLICIES.comment.limit).toBeLessThanOrEqual(60);
    expect(RATE_LIMIT_POLICIES.email.window).toBe("1 h");
  });
});

describe("short-lived cache", () => {
  it("just runs the loader when Redis is not configured", async () => {
    const load = vi.fn(async () => 7);
    expect(await cached("k", 60, load)).toBe(7);
    expect(await cached("k", 60, load)).toBe(7);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("returns a hit without calling the loader", async () => {
    configureRedis();
    getMock.mockResolvedValue({ n: 1 });
    const load = vi.fn(async () => ({ n: 2 }));
    expect(await cached("k", 60, load)).toEqual({ n: 1 });
    expect(load).not.toHaveBeenCalled();
  });

  it("stores a miss with an expiry (never permanently)", async () => {
    configureRedis();
    getMock.mockResolvedValue(null);
    expect(await cached("active", 60, async () => ["a"])).toEqual(["a"]);
    expect(setMock).toHaveBeenCalledWith("medyra:test:cache:v1:active", ["a"], { ex: 60 });
  });

  it("falls back to the loader when Redis reads or writes fail", async () => {
    configureRedis();
    getMock.mockRejectedValueOnce(new Error("down"));
    expect(await cached("k", 60, async () => 5)).toBe(5);

    getMock.mockResolvedValueOnce(null);
    setMock.mockRejectedValueOnce(new Error("down"));
    expect(await cached("k", 60, async () => 6)).toBe(6);
  });

  it("invalidates by deleting the key, and tolerates failure", async () => {
    configureRedis();
    await invalidate("k");
    expect(delMock).toHaveBeenCalledWith("medyra:test:cache:v1:k");
    delMock.mockRejectedValueOnce(new Error("down"));
    await expect(invalidate("k")).resolves.toBeUndefined();
  });
});
