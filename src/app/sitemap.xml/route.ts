import { NextResponse } from "next/server";

import { readOrGenerateSitemap } from "@lib/sitemaps";

// Entry point consumed by search engines. Serves the sitemap index that links
// to all sub-sitemaps (posts, posts with áudio, and tags). If the files are
// missing on disk we regenerate them on the fly before responding.
export async function GET() {
  const xml = await readOrGenerateSitemap("index");
  if (!xml) {
    return new NextResponse("Failed to generate sitemap index", { status: 500 });
  }

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
