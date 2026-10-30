import type { MetadataRoute } from "next";
import { footerLinks, siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  // "/" is the member home (it redirects visitors to /welcome), so the public entry is /welcome.
  const paths = ["/welcome", ...footerLinks.map((l) => l.href)];
  return paths.map((path) => ({ url: `${siteConfig.url}${path}` }));
}
