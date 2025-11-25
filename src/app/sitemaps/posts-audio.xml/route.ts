import { NextResponse } from "next/server";

import { readOrGenerateSitemap } from "@lib/sitemaps";

// Lists only posts that have áudio, enriching entries with image and video
// namespaces to represent the audio payload.
export async function GET() {
  const xml = await readOrGenerateSitemap("posts-audio");
  if (!xml) {
    return new NextResponse("Failed to generate posts audio sitemap", { status: 500 });
  }

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
