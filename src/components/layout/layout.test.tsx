import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/home";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));

const { AppHeader } = await import("@/components/layout/app-header");
const { MobileTabBar } = await import("@/components/layout/mobile-tab-bar");
const { appNav, isActivePath } = await import("@/features/home/nav");

const member = {
  username: "amina_r",
  first_name: "Amina",
  last_name: "Rahman",
  avatar_path: null,
};

beforeEach(() => {
  pathname = "/home";
});

describe("MobileTabBar", () => {
  it("puts Home, Search, Post and Profile one tap away", () => {
    render(<MobileTabBar username="amina_r" />);
    const nav = screen.getByRole("navigation", { name: "Mobile" });
    expect(within(nav).getByRole("link", { name: /home/i })).toHaveAttribute("href", "/home");
    expect(within(nav).getByRole("link", { name: /search/i })).toHaveAttribute("href", "/search");
    expect(within(nav).getByRole("link", { name: /post/i })).toHaveAttribute(
      "href",
      "/home#composer",
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
      "/home",
      "/profile/amina_r",
      "/communities",
      "/mentorship",
      "/careers",
      "/saved",
      "/settings",
    ]);
    expect(within(dialog).getAllByText("Coming soon")).toHaveLength(4);
    expect(within(dialog).getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});

describe("AppHeader", () => {
  it("has the logo, a member search, Home, Profile and the account menu", () => {
    render(<AppHeader member={member} />);
    expect(screen.getByRole("search")).toHaveAttribute("action", "/search");
    expect(screen.getByRole("searchbox", { name: /search members/i })).toHaveAttribute("name", "q");
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/home");
    expect(within(main).getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile/amina_r",
    );
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
      within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Profile" }),
    ).toHaveAttribute("href", "/profile/edit");
  });
});

describe("app navigation config", () => {
  it("marks unbuilt modules as soon and builds the profile link from the username", () => {
    const nav = appNav("amina_r");
    expect(nav.filter((n) => n.soon).map((n) => n.key)).toEqual([
      "communities",
      "mentorship",
      "careers",
      "saved",
    ]);
    expect(nav.find((n) => n.key === "profile")?.href).toBe("/profile/amina_r");
  });

  it("matches nested paths but not Home for every page", () => {
    expect(isActivePath("/profile/amina_r", "/profile/amina_r")).toBe(true);
    expect(isActivePath("/settings/anything", "/settings")).toBe(true);
    expect(isActivePath("/settings", "/home")).toBe(false);
    expect(isActivePath("/home", "/home")).toBe(true);
  });
});
