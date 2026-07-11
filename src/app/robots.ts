import type { MetadataRoute } from "next"
import { absoluteUrl, siteConfig } from "@/lib/seo"
import { getSitemapDescriptors } from "@/lib/sitemaps"

export default async function robots(): Promise<MetadataRoute.Robots> {
  const sitemaps = await getSitemapDescriptors()
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/sign-in/", "/sign-up/"],
    },
    sitemap: sitemaps.map(({ id }) => absoluteUrl(`/sitemap/${id}.xml`)),
    host: siteConfig.url,
  }
}
