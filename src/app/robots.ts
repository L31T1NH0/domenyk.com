import type { MetadataRoute } from "next"
import { absoluteUrl, siteConfig } from "@/lib/seo"
import { getSitemapDescriptors } from "@/lib/sitemaps"

export default async function robots(): Promise<MetadataRoute.Robots> {
  const sitemaps = await getSitemapDescriptors()
  const protectedPaths = ["/admin/", "/api/", "/sign-in/", "/sign-up/"]

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: protectedPaths,
      },
      {
        userAgent: ["OAI-SearchBot", "GPTBot", "ChatGPT-User"],
        allow: "/",
        disallow: protectedPaths,
      },
    ],
    sitemap: sitemaps.map(({ id }) => absoluteUrl(`/sitemap/${id}.xml`)),
    host: siteConfig.url,
  }
}
