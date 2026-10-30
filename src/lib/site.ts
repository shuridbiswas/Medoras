export const siteConfig = {
  name: "Medyra",
  copyrightYear: 2026,
  tagline: "Connect. Learn. Grow. Belong.",
  secondaryTagline: "More than a career. A community that cares.",
  description:
    "Medyra is the professional and social network for the healthcare and social services community: connect with peers, find mentors, share knowledge, and discover opportunities.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export const navLinks = [
  { label: "Why Medyra", href: "/welcome#why" },
  { label: "Community", href: "/welcome#community" },
  { label: "Mentorship", href: "/welcome#mentorship" },
  { label: "Careers", href: "/welcome#careers" },
] as const;

export const authLinks = {
  signIn: "/login",
  join: "/signup",
} as const;

export const footerLinks = [
  { label: "About", href: "/about" },
  { label: "Community Guidelines", href: "/community-guidelines" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "/contact" },
] as const;
