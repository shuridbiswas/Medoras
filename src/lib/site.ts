export const siteConfig = {
  name: "Medoras",
  copyrightYear: 2026,
  tagline: "Connect. Learn. Grow. Belong.",
  secondaryTagline: "More than a career. A community that cares.",
  description:
    "Medoras is the professional and social network for the healthcare and social services community: connect with peers, find mentors, share knowledge, and discover opportunities.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export const navLinks = [
  { label: "Why Medoras", href: "/#why" },
  { label: "Community", href: "/#community" },
  { label: "Mentorship", href: "/#mentorship" },
  { label: "Careers", href: "/#careers" },
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
