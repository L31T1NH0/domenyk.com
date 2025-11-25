import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { defaultDependencies, resolvePostResponse } from "./handler";
import { renderPostMdx } from "../../../../lib/renderers/mdx";
import { renderMarkdown } from "../../../../lib/renderers/markdown";
import { normalizeMarkdownContent } from "../../../../lib/markdown-normalize";
import { resolveAdminStatus } from "../../../../lib/admin";
import { triggerSitemapRegeneration } from "@lib/sitemaps";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return resolvePostResponse(req, params, defaultDependencies);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const postId = params?.id;

  if (!postId || typeof postId !== "string") {
    return NextResponse.json(
      { error: "Post ID is required and must be a string" },
      { status: 400 }
    );
  }

  const { isAdmin } = await resolveAdminStatus();

  if (!isAdmin) {
    return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
  }

  let contentMarkdown: string | null = null;

  try {
    const body = (await req.json()) as { contentMarkdown?: unknown };
    if (typeof body?.contentMarkdown !== "string") {
      return NextResponse.json(
        { error: "contentMarkdown is required and must be a string" },
        { status: 400 }
      );
    }
    contentMarkdown = normalizeMarkdownContent(body.contentMarkdown);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!contentMarkdown || contentMarkdown.trim() === "") {
    return NextResponse.json(
      { error: "contentMarkdown must not be empty" },
      { status: 400 }
    );
  }

  try {
    const { getMongoDb } = await import("../../../../lib/mongo");
    const db = await getMongoDb();
    const postsCollection = db.collection("posts");

    const result = await postsCollection.updateOne(
      { postId },
      {
        $set: {
          contentMarkdown,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const shouldUseMdxRenderer = process.env.FEATURE_MDX_RENDERER === "true";
    let htmlContent: string;

    if (shouldUseMdxRenderer) {
      try {
        htmlContent = await renderPostMdx(contentMarkdown);
      } catch (error) {
        console.error(`MDX renderer failed for post ${postId}:`, error);
        htmlContent = await renderMarkdown(contentMarkdown);
      }
    } else {
      htmlContent = await renderMarkdown(contentMarkdown);
    }

    await triggerSitemapRegeneration();

    return NextResponse.json({
      contentMarkdown,
      htmlContent,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to update post content", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
