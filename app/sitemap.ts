import type { MetadataRoute } from "next";

const siteUrl = "https://frame-blood-pressure.suvang.chatgpt.site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date("2026-07-30"),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${siteUrl}/interest`,
      lastModified: new Date("2026-08-01"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: new Date("2026-07-30"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
