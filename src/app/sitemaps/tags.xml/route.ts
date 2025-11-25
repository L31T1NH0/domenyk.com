import { NextResponse } from "next/server";

import { readOrGenerateSitemap } from "@lib/sitemaps";

// Groups tag pages using the most recent post date as lastmod for each tag.
export async function GET() {
  const xml = await readOrGenerateSitemap("tags");
  if (!xml) {
    return new NextResponse("Failed to generate tags sitemap", { status: 500 });
  }

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
