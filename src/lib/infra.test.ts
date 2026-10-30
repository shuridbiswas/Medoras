// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";

vi.mock("server-only", () => ({}));
// connection() only works inside a real request; in unit tests it is a no-op.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

const { scrubEvent, redactObject } = await import("@/lib/monitoring/scrub");
const { serviceStatus } = await import("@/lib/services");
const health = await import("@/app/api/health/route");
const sentryTest = await import("@/app/api/sentry-test/route");
const { productbridgeLinks } = await import("@/features/feedback/config");
const { NextRequest } = await import("next/server");

afterEach(() => vi.unstubAllEnvs());

describe("Sentry scrubbing (no member content, credentials or contact details leave the app)", () => {
  const event = (): ErrorEvent =>
    ({
      type: undefined,
      request: {
        url: "https://medyra.example/search?q=my+diagnosis&token=abc",
        query_string: "q=my+diagnosis&token=abc",
        cookies: { "sb-access-token": "secret" },
        data: { body: "private post text", password: "hunter2" },
        headers: { Authorization: "Bearer xyz", cookie: "a=b", "user-agent": "jest" },
      },
      user: { id: "u1", email: "amina@example.com", ip_address: "1.2.3.4", username: "amina" },
      breadcrumbs: [
        { category: "console", message: "post body: patient John" },
        { category: "fetch", data: { url: "/x", password: "p", authorization: "t" } },
      ],
      extra: { body: "hello", code: "23505", nested: { token: "t", ok: 1 } },
      contexts: { custom: { email: "a@b.c", fine: "yes" } },
    }) as unknown as ErrorEvent;

  it("removes cookies, bodies, query strings and secret headers", () => {
    const out = scrubEvent(event());
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.data).toBeUndefined();
    expect(out.request?.query_string).toBeUndefined();
    expect(out.request?.url).toBe("https://medyra.example/search");
    expect(out.request?.headers?.Authorization).toBe("[redacted]");
    expect(out.request?.headers?.cookie).toBe("[redacted]");
    expect(out.request?.headers?.["user-agent"]).toBe("jest");
  });

  it("keeps only an opaque member id", () => {
    expect(scrubEvent(event()).user).toEqual({ id: "u1" });
    const anon = event();
    anon.user = { email: "x@y.z" };
    expect(scrubEvent(anon).user).toBeUndefined();
  });

  it("drops console breadcrumbs and redacts sensitive keys everywhere else", () => {
    const out = scrubEvent(event());
    expect(out.breadcrumbs?.[0].message).toBe("[console message removed]");
    expect(out.breadcrumbs?.[1].data).toEqual({ url: "/x", password: "[redacted]", authorization: "[redacted]" });
    expect(out.extra).toEqual({ body: "[redacted]", code: "23505", nested: { token: "[redacted]", ok: 1 } });
    expect(out.contexts).toEqual({ custom: { email: "[redacted]", fine: "yes" } });
    expect(JSON.stringify(out)).not.toMatch(/hunter2|private post text|amina@example|Bearer xyz|patient John/);
  });

  it("redacts recursively without mutating the input", () => {
    const input = { a: { password: "x", list: [{ token: "y", n: 1 }] } };
    expect(redactObject(input)).toEqual({ a: { password: "[redacted]", list: [{ token: "[redacted]", n: 1 }] } });
    expect(input.a.password).toBe("x");
  });
});

describe("service status and health check", () => {
  beforeEach(() => {
    for (const name of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SENTRY_DSN",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "RESEND_API_KEY",
      "EMAIL_FROM",
      "NEXT_PUBLIC_PRODUCTBRIDGE_ORG_ID",
      "PINECONE_API_KEY",
      "PINECONE_INDEX",
      "TWO_FACTOR_SECRET",
    ])
      vi.stubEnv(name, "");
  });

  it("reports every optional service as off when nothing is configured", () => {
    expect(serviceStatus()).toEqual({
      supabase: false,
      sentry: false,
      upstashRedis: false,
      resend: false,
      productbridge: false,
      pinecone: false,
      twoFactorEmail: false,
    });
  });

  it("reports email sign-in codes as on only with the signing secret AND email delivery", () => {
    vi.stubEnv("TWO_FACTOR_SECRET", "s".repeat(40));
    expect(serviceStatus().twoFactorEmail).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "re_x");
    vi.stubEnv("EMAIL_FROM", "Medyra <a@b.co>");
    expect(serviceStatus().twoFactorEmail).toBe(true);
    vi.stubEnv("TWO_FACTOR_SECRET", "too-short");
    expect(serviceStatus().twoFactorEmail).toBe(false);
  });

  it("needs ALL variables of a service before calling it configured", () => {
    vi.stubEnv("RESEND_API_KEY", "re_x");
    expect(serviceStatus().resend).toBe(false);
    vi.stubEnv("EMAIL_FROM", "Medyra <a@b.co>");
    expect(serviceStatus().resend).toBe(true);
    vi.stubEnv("PINECONE_API_KEY", "k");
    expect(serviceStatus().pinecone).toBe(false);
  });

  it("returns presence only and never leaks a secret value", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_SUPER_SECRET_VALUE");
    vi.stubEnv("EMAIL_FROM", "Medyra <a@b.co>");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "TOKEN_SECRET_VALUE");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://secret-host.upstash.io");
    const response = await health.GET();
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(text).not.toMatch(/SECRET|secret-host|a@b\.co/);
    expect(JSON.parse(text)).toMatchObject({ status: "ok", services: { resend: true, upstashRedis: true } });
  });
});

describe("Sentry test route", () => {
  const call = (token?: string) =>
    sentryTest.GET(
      new NextRequest("https://medyra.test/api/sentry-test", {
        headers: token === undefined ? {} : { "x-sentry-test-token": token },
      }),
    );

  it("is invisible (404) unless a server token is configured", async () => {
    vi.stubEnv("SENTRY_TEST_TOKEN", "");
    expect((await call("anything")).status).toBe(404);
    expect((await call()).status).toBe(404);
  });

  it("rejects a wrong token", async () => {
    vi.stubEnv("SENTRY_TEST_TOKEN", "correct-token");
    expect((await call("wrong-token!!")).status).toBe(404);
    expect((await call("short")).status).toBe(404);
  });

  it("throws the deliberate exception for the right token", async () => {
    vi.stubEnv("SENTRY_TEST_TOKEN", "correct-token");
    await expect(call("correct-token")).rejects.toThrow(/deliberate server exception/);
  });
});

describe("ProductBridge links", () => {
  it("are off without an organization id or with a malformed one", () => {
    expect(productbridgeLinks(undefined)).toBeNull();
    expect(productbridgeLinks("")).toBeNull();
    expect(productbridgeLinks("a b")).toBeNull();
    expect(productbridgeLinks("x/../y")).toBeNull();
    expect(productbridgeLinks("<script>")).toBeNull();
  });

  it("use the documented direct-URL pattern", () => {
    expect(productbridgeLinks("org_123")).toEqual({
      feedback: "https://app.productbridge.io/widget/org_123?tab=feedback",
      roadmap: "https://app.productbridge.io/widget/org_123?tab=roadmap",
      changelog: "https://app.productbridge.io/widget/org_123?tab=changelog",
    });
  });
});
