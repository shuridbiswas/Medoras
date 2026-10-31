import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));
// Async server components (they query the database) are covered by their own tests.
vi.mock("@/features/notifications/components/notification-bell", () => ({
  NotificationBell: () => null,
  BellLink: () => null,
}));
vi.mock("@/features/network/components/request-count", () => ({
  RequestCountBadge: () => null,
}));

const { AppHeader } = await import("@/components/layout/app-header");
const { MobileTabBar } = await import("@/components/layout/mobile-tab-bar");
const { appNav, isActivePath } = await import("@/features/home/nav");

const member = {
  id: "u1",
  username: "amina_r",
  first_name: "Amina",
  last_name: "Rahman",
  avatar_path: null,
};

beforeEach(() => {
  pathname = "/";
});

describe("MobileTabBar", () => {
  it("puts Home, Network, Post and Profile one tap away", () => {
    render(<MobileTabBar username="amina_r" />);
    const nav = screen.getByRole("navigation", { name: "Mobile" });
    expect(within(nav).getByRole("link", { name: /home/i })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: /network/i })).toHaveAttribute("href", "/network");
    expect(within(nav).getByRole("link", { name: /post/i })).toHaveAttribute(
      "href",
      "/#composer",
    );
    expect(within(nav).getByRole("link", { name: /profile/i })).toHaveAttribute(
      "href",
      "/profile/amina_r",
    );
  });

  it("marks the current page", () => {
    pathname = "/profile/amina_r";
    render(<MobileTabBar username="amina_r" />);
    expect(screen.getByRole("link", { name: /profile/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^home/i })).not.toHaveAttribute("aria-current");
  });

  it("opens a menu with every section, flagging the ones that are not built", async () => {
    const user = userEvent.setup();
    render(<MobileTabBar username="amina_r" />);
    await user.click(screen.getByRole("button", { name: /more/i }));

    const dialog = await screen.findByRole("dialog");
    const links = within(dialog).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/",
      "/network",
      "/communities",
      "/forums",
      "/messages",
      "/mentorship",
      "/saved",
      "/profile/amina_r",
      "/careers",
      "/settings",
    ]);
    expect(within(dialog).getAllByText("Coming soon")).toHaveLength(1);
    expect(within(dialog).getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});

describe("AppHeader", () => {
  it("has the logo, a member search, the sidebar sections, New Post and the account menu", () => {
    render(<AppHeader member={member} />);
    expect(screen.getByRole("search")).toHaveAttribute("action", "/network");
    expect(screen.getByRole("searchbox", { name: /search members/i })).toHaveAttribute("name", "q");
    const sidebar = screen.getByRole("navigation", { name: "Sections" });
    expect(
      within(sidebar)
        .getAllByRole("link")
        .map((l) => l.getAttribute("href")),
    ).toEqual([
      "/",
      "/network",
      "/communities",
      "/forums",
      "/messages",
      "/mentorship",
      "/saved",
      "/profile/amina_r",
      "/careers",
      "/settings",
    ]);
    expect(screen.getByRole("link", { name: /new post/i })).toHaveAttribute("href", "/#composer");
    expect(screen.getAllByRole("link", { name: /medyra home/i }).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /account menu for amina rahman/i }),
    ).toBeInTheDocument();
  });

  it("opens an account menu with profile, settings and sign out", async () => {
    const user = userEvent.setup();
    render(<AppHeader member={member} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    expect(await screen.findByRole("menuitem", { name: /my profile/i })).toHaveAttribute(
      "href",
      "/profile/amina_r",
    );
    expect(screen.getByRole("menuitem", { name: /settings/i })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.getByText("@amina_r")).toBeInTheDocument();
  });

  it("falls back to the profile editor when a member has no username yet", () => {
    render(<AppHeader member={{ ...member, username: null }} />);
    expect(
      within(screen.getByRole("navigation", { name: "Sections" })).getByRole("link", { name: "Profile" }),
    ).toHaveAttribute("href", "/profile/edit");
  });
});

describe("app navigation config", () => {
  it("marks unbuilt modules as soon and builds the profile link from the username", () => {
    const nav = appNav("amina_r");
    expect(nav.filter((n) => n.soon).map((n) => n.key)).toEqual(["careers"]);
    // Network and Saved are real now; the secondary group sits below a divider.
    expect(nav.find((n) => n.key === "network")).toMatchObject({ href: "/network", group: "primary" });
    expect(nav.find((n) => n.key === "saved")).toMatchObject({ href: "/saved" });
    expect(nav.find((n) => n.key === "saved")?.soon).toBeUndefined();
    expect(nav.filter((n) => n.group === "secondary").map((n) => n.key)).toEqual(["careers", "settings"]);
    expect(nav.find((n) => n.key === "profile")?.href).toBe("/profile/amina_r");
  });

  it("matches nested paths but not Home for every page", () => {
    expect(isActivePath("/profile/amina_r", "/profile/amina_r")).toBe(true);
    expect(isActivePath("/settings/anything", "/settings")).toBe(true);
    expect(isActivePath("/settings", "/")).toBe(false);
    expect(isActivePath("/profile/x", "/")).toBe(false); // "/" matches only itself
    expect(isActivePath("/", "/")).toBe(true);
  });
});
