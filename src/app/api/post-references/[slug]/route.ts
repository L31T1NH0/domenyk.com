import { NextResponse } from "next/server";

import { getPostReferenceMetadata } from "../../../../lib/posts";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const paramsData = await params;
  const slug = paramsData.slug;

  if (!slug || typeof slug !== "string") {
    return NextResponse.json(
      { error: "Slug is required" },
      { status: 400 }
    );
  }

  try {
    const metadata = await getPostReferenceMetadata(slug);

    if (!metadata) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(metadata, { status: 200 });
  } catch (error) {
    console.error("Failed to load post reference metadata", {
      slug,
      error,
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
