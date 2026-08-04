import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date("2026-08-04"),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/interest`,
      lastModified: new Date("2026-08-01"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: new Date("2026-08-02"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date("2026-08-03"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
