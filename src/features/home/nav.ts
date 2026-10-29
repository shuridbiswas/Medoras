import {
  Bookmark,
  Briefcase,
  GraduationCap,
  Home,
  Settings,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AppNavItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** True for modules that are not built yet; their page says so plainly. */
  soon?: boolean;
};

/** Signed-in navigation. "Soon" items lead to an informational page, never to a fake feature. */
export function appNav(username: string | null): AppNavItem[] {
  return [
    { key: "home", label: "Home", href: "/home", icon: Home },
    {
      key: "profile",
      label: "My Profile",
      href: username ? `/profile/${username}` : "/profile/edit",
      icon: User,
    },
    {
      key: "communities",
      label: "Communities",
      href: "/communities",
      icon: Users,
      soon: true,
    },
    {
      key: "mentorship",
      label: "Mentorship",
      href: "/mentorship",
      icon: GraduationCap,
      soon: true,
    },
    {
      key: "careers",
      label: "Careers",
      href: "/careers",
      icon: Briefcase,
      soon: true,
    },
    {
      key: "saved",
      label: "Saved Posts",
      href: "/saved",
      icon: Bookmark,
      soon: true,
    },
    { key: "settings", label: "Settings", href: "/settings", icon: Settings },
  ];
}

export const isActivePath = (pathname: string, href: string) =>
  pathname === href || (href !== "/home" && pathname.startsWith(`${href}/`));
