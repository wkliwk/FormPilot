import type { MetadataRoute } from "next";
import { SEO_FORMS } from "@/lib/seo-forms";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const formPages: MetadataRoute.Sitemap = SEO_FORMS.map((f) => ({
    url: `${APP_URL}/forms/${f.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: APP_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${APP_URL}/demo`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${APP_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${APP_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${APP_URL}/dashboard/extension`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${APP_URL}/changelog`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    ...formPages,
  ];
}
