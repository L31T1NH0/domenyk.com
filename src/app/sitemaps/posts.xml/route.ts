import { NextResponse } from "next/server";

import { readOrGenerateSitemap } from "@lib/sitemaps";

// Lists all public posts with thumbnails and realistic changefreq.
export async function GET() {
  const xml = await readOrGenerateSitemap("posts");
  if (!xml) {
    return new NextResponse("Failed to generate posts sitemap", { status: 500 });
  }

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
