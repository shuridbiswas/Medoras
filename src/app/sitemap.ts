import type { MetadataRoute } from "next";
import { footerLinks, siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", ...footerLinks.map((l) => l.href)];
  return paths.map((path) => ({ url: `${siteConfig.url}${path}` }));
}
