import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { clientPromise } from "../../../../../lib/mongo";
import { resolveAdminStatus } from "../../../../../lib/admin";

export async function POST(request: NextRequest) {
  const { isAdmin } = await resolveAdminStatus();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { postIds } = body as { postIds: string[] | "all" };

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB || "blog");
  const collection = db.collection("posts");

  let posts;
  if (postIds === "all") {
    posts = await collection
      .find({}, { projection: { postId: 1, title: 1, subtitle: 1, contentMarkdown: 1, content: 1, date: 1, tags: 1 } })
      .toArray();
  } else {
    if (!Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json({ error: "Nenhum post selecionado." }, { status: 400 });
    }
    posts = await collection
      .find(
        { postId: { $in: postIds } },
        { projection: { postId: 1, title: 1, subtitle: 1, contentMarkdown: 1, content: 1, date: 1, tags: 1 } }
      )
      .toArray();
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ error: "Nenhum post encontrado." }, { status: 404 });
  }

  const zip = new JSZip();
  const folder = zip.folder("posts")!;

  for (const post of posts) {
    const safeTitle = (post.title || post.postId || "post")
      .replace(/[^a-zA-Z0-9À-ÿ\s\-_]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .substring(0, 80);

    const lines: string[] = [];
    lines.push(`# ${post.title || ""}`);
    if (post.subtitle) lines.push(`## ${post.subtitle}`);
    lines.push("");
    if (post.date) lines.push(`Data: ${post.date}`);
    if (post.tags?.length) lines.push(`Tags: ${post.tags.join(", ")}`);
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(post.contentMarkdown || post.content || "");

    folder.file(`${safeTitle}.txt`, lines.join("\n"));
  }

  const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="posts-${Date.now()}.zip"`,
    },
  });
}
