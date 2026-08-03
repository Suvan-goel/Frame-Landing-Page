import type { MetadataRoute } from "next";

const siteUrl = "https://framewearable.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy"],
      disallow: [
        "/admin/",
        "/api/",
        "/contributors",
        "/founding-contributors",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
