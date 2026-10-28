import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Hero } from "@/features/landing/sections/hero";
import { features } from "@/features/landing/content";
import { authLinks, footerLinks, navLinks } from "@/lib/site";

describe("landing content", () => {
  it("covers the eight platform pillars", () => {
    expect(features).toHaveLength(8);
  });

  it("points every nav link at a section or route", () => {
    for (const link of [...navLinks, ...footerLinks]) {
      expect(link.href.startsWith("/")).toBe(true);
    }
  });

  it("routes sign in to /login and join to /signup", () => {
    expect(authLinks.signIn).toBe("/login");
    expect(authLinks.join).toBe("/signup");
  });
});

describe("Hero", () => {
  it("renders the headline and both calls to action", () => {
    render(<Hero />);
    expect(
      screen.getByRole("heading", { level: 1, name: /your community/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /join medoras/i })).toHaveAttribute(
      "href",
      authLinks.join,
    );
    expect(
      screen.getByRole("link", { name: /discover medoras/i }),
    ).toHaveAttribute("href", "/#why");
  });
});
