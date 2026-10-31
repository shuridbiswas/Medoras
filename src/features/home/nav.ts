import {
  Bookmark,
  Briefcase,
  GraduationCap,
  MessageCircleQuestion,
  MessageSquare,
  Home,
  Settings,
  User,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type AppNavItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** True for modules that are not built yet; their page says so plainly. */
  soon?: boolean;
  /** Primary items fill the sidebar; secondary ones sit below a divider. */
  group: "primary" | "secondary";
};

/** Signed-in navigation. "Soon" items lead to an informational page, never to a fake feature. */
export function appNav(username: string | null): AppNavItem[] {
  return [
    { key: "home", label: "Home", href: "/", icon: Home, group: "primary" },
    { key: "network", label: "Network", href: "/network", icon: UsersRound, group: "primary" },
    {
      key: "communities",
      label: "Communities",
      href: "/communities",
      icon: Users,
      group: "primary",
    },
    { key: "forums", label: "Forums", href: "/forums", icon: MessageCircleQuestion, group: "primary" },
    { key: "messages", label: "Messages", href: "/messages", icon: MessageSquare, group: "primary" },
    {
      key: "mentorship",
      label: "Mentorship",
      href: "/mentorship",
      icon: GraduationCap,
      group: "primary",
    },
    { key: "saved", label: "Saved", href: "/saved", icon: Bookmark, group: "primary" },
    {
      key: "profile",
      label: "Profile",
      href: username ? `/profile/${username}` : "/profile/edit",
      icon: User,
      group: "primary",
    },
    {
      key: "careers",
      label: "Careers",
      href: "/careers",
      icon: Briefcase,
      soon: true,
      group: "secondary",
    },
    { key: "settings", label: "Settings", href: "/settings", icon: Settings, group: "secondary" },
  ];
}

export const isActivePath = (pathname: string, href: string) =>
  pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
