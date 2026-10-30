import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/privacy", useRouter: () => ({ push: vi.fn() }) }));

const { default: Privacy } = await import("@/app/privacy/page");
const { default: Terms } = await import("@/app/terms/page");
const { default: Guidelines } = await import("@/app/community-guidelines/page");

const pages = [
  ["Privacy policy", Privacy],
  ["Terms of use", Terms],
  ["Community Guidelines", Guidelines],
] as const;

beforeEach(() => {
  delete process.env.PRIVACY_CONTACT_EMAIL;
});

describe.each(pages)("%s", (title, Page) => {
  it("is plainly marked as a draft that needs legal review and is not legal advice", () => {
    render(<Page />);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(/draft for legal review/i);
    expect(note).toHaveTextContent(/not legal advice/i);
    expect(note).toHaveTextContent(/does not on its own make medyra compliant/i);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
  });

  it("never claims compliance, certification or verification it does not have", () => {
    const { container } = render(<Page />);
    const text = (container.textContent ?? "").replace(screen.getByRole("note").textContent ?? "", "");
    expect(text).not.toMatch(/\b(is|are) (fully )?(compliant|certified|hipaa|pipeda compliant|law 25 compliant)/i);
    expect(text).not.toMatch(/\b(ai|automated) moderation (is|are) (active|enabled|on)\b/i);
    expect(text).not.toMatch(/verified (professionals|members) only/i);
  });
});

describe("Privacy policy content", () => {
  it("lists real data flows and providers, and what is switched off", () => {
    render(<Privacy />);
    for (const provider of ["Supabase", "Netlify", "Resend", "Sentry", "Upstash", "Pinecone", "ProductBridge"]) {
      expect(screen.getAllByText(new RegExp(provider)).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/switched off unless configured/i)).toBeInTheDocument();
    expect(screen.getByText(/no advertising or analytics cookies/i)).toBeInTheDocument();
    expect(screen.getByText(/planned and not active/i)).toBeInTheDocument();
  });

  it("is honest that no privacy contact exists until one is configured, and never invents one", () => {
    const { container } = render(<Privacy />);
    expect(screen.getByText(/not yet set up/i)).toBeInTheDocument();
    expect(container.querySelector("a[href^='mailto:']")).toBeNull();
  });

  it("shows the configured privacy contact when there is one", () => {
    process.env.PRIVACY_CONTACT_EMAIL = "privacy@example.org";
    const { container } = render(<Privacy />);
    expect(container.querySelector("a[href='mailto:privacy@example.org']")).not.toBeNull();
  });

  it("names the Law 25 and other items still needing a lawyer", () => {
    render(<Privacy />);
    expect(screen.getByRole("heading", { name: /for the lawyer/i })).toBeInTheDocument();
    expect(screen.getByText(/law 25 \(québec\)/i)).toBeInTheDocument();
    expect(screen.getByText(/french-language availability/i)).toBeInTheDocument();
  });

  it("links to the real settings for access, deletion and visibility", () => {
    const { container } = render(<Privacy />);
    expect(container.querySelector("a[href='/settings/privacy']")).not.toBeNull();
  });
});

describe("Community guidelines content", () => {
  it("describes the tools that exist (report, mute, block, appeals) and still denies automated moderation", () => {
    render(<Guidelines />);
    expect(screen.getByText(/automated moderation is not active/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /your tools/i })).toBeInTheDocument();
    expect(screen.getByText(/can appeal and a person reviews the appeal/i)).toBeInTheDocument();
    expect(screen.queryByText(/reporting tools are not built yet/i)).not.toBeInTheDocument();
  });
});
