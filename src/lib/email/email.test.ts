// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
const rateLimit = vi.fn();
let prefRow: { notify_activity: boolean } | null = null;
let prefError = false;

vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    constructor(public key: string) {}
    emails = { send: sendMock };
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => rateLimit(...a) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (prefError) throw new Error("db");
            return { data: prefRow, error: null };
          },
        }),
      }),
    }),
  }),
}));

const { sendToMember, resetEmailClientForTests } = await import("@/lib/email/send");
const templates = await import("@/lib/email/templates");

const member = { id: "u1", email: "amina@example.com" };

function configure() {
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("EMAIL_FROM", "Medyra <hello@mail.example.com>");
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEmailClientForTests();
  rateLimit.mockResolvedValue({ ok: true, enforced: true });
  sendMock.mockResolvedValue({ data: { id: "email_1" }, error: null });
  prefRow = null;
  prefError = false;
});
afterEach(() => vi.unstubAllEnvs());

describe("templates", () => {
  it("brand every email as Medyra and include a plain-text alternative", () => {
    const messages = [
      templates.welcomeEmail({ firstName: "Amina", username: "amina_r" }),
      templates.securityNotificationEmail({ firstName: "Amina", event: "password_changed" }),
      templates.commentNotificationEmail({
        recipientFirstName: "Amina",
        commenterName: "Sam",
        postUrlPath: "/home",
      }),
      templates.connectionNotificationEmail({ recipientFirstName: "Amina", requesterName: "Sam" }),
    ];
    for (const m of messages) {
      expect(m.html).toContain("Medyra");
      expect(m.html).not.toMatch(/medoras/i);
      expect(m.text.length).toBeGreaterThan(20);
      expect(m.subject.length).toBeGreaterThan(5);
    }
  });

  it("escapes member-supplied names so they cannot inject markup", () => {
    const m = templates.welcomeEmail({ firstName: '<img src=x onerror="alert(1)">', username: "a_b" });
    expect(m.html).not.toContain("<img");
    expect(m.html).toContain("&lt;img");
    const c = templates.commentNotificationEmail({
      recipientFirstName: "A",
      commenterName: "<script>x</script>",
      postUrlPath: "/home",
    });
    expect(c.html).not.toContain("<script>");
  });

  it("links to the profile and tells members never to share patient information", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://medyra.example");
    const m = templates.welcomeEmail({ firstName: "Amina", username: "amina_r" });
    expect(m.text).toContain("https://medyra.example/profile/amina_r");
    expect(m.text).toMatch(/never share information that could identify a patient/i);
  });

  it("sends a security notice that links to password reset", () => {
    const m = templates.securityNotificationEmail({ firstName: "A", event: "password_changed" });
    expect(m.text).toContain("/forgot-password");
  });
});

describe("sendToMember", () => {
  const message = templates.welcomeEmail({ firstName: "Amina", username: "amina_r" });

  it("does nothing, without error, when Resend is not configured", async () => {
    expect(await sendToMember(member, message, "transactional")).toEqual({
      status: "skipped",
      reason: "not_configured",
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends only to the verified member's own address, with text and html", async () => {
    configure();
    expect(await sendToMember(member, message, "transactional")).toEqual({
      status: "sent",
      id: "email_1",
    });
    expect(sendMock).toHaveBeenCalledWith({
      from: "Medyra <hello@mail.example.com>",
      to: ["amina@example.com"],
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  });

  it("refuses a missing or malformed recipient", async () => {
    configure();
    for (const email of [undefined, "", "not-an-email", "a@b"]) {
      expect(await sendToMember({ id: "u1", email }, message, "transactional")).toEqual({
        status: "skipped",
        reason: "no_email",
      });
    }
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid message payload", async () => {
    configure();
    expect(await sendToMember(member, { subject: "", html: "x", text: "x" }, "transactional")).toEqual({
      status: "failed",
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("respects the activity-email preference but always sends security notices", async () => {
    configure();
    prefRow = { notify_activity: false };
    expect(await sendToMember(member, message, "activity")).toEqual({
      status: "skipped",
      reason: "preference_off",
    });
    expect(await sendToMember(member, message, "security")).toMatchObject({ status: "sent" });
    prefRow = { notify_activity: true };
    expect(await sendToMember(member, message, "activity")).toMatchObject({ status: "sent" });
    prefRow = null; // no row = default on
    expect(await sendToMember(member, message, "activity")).toMatchObject({ status: "sent" });
  });

  it("is rate limited per member", async () => {
    configure();
    rateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 30, message: "slow down" });
    expect(await sendToMember(member, message, "transactional")).toEqual({
      status: "skipped",
      reason: "rate_limited",
    });
    expect(rateLimit).toHaveBeenCalledWith("email", "u1");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("never throws when Resend fails", async () => {
    configure();
    sendMock.mockResolvedValue({ data: null, error: { name: "validation_error", message: "bad" } });
    expect(await sendToMember(member, message, "transactional")).toEqual({ status: "failed" });
    sendMock.mockRejectedValue(new Error("network"));
    expect(await sendToMember(member, message, "transactional")).toEqual({ status: "failed" });
  });

  it("still sends activity email if the preference lookup itself fails (default on)", async () => {
    configure();
    prefError = true;
    expect(await sendToMember(member, message, "activity")).toMatchObject({ status: "sent" });
  });
});
