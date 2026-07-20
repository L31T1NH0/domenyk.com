import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { adminOnly } from "@/lib/auth"
import { getDb } from "@/lib/db/client"
import type { Post } from "@/lib/db/posts"
import { siteDateKey } from "@/lib/datetime"

function frontMatterValue(value: string) {
  return JSON.stringify(value)
}

function postToMarkdown(post: Post) {
  const publishedAt = post.publishedAt?.toISOString() ?? ""
  const tags = post.tags.length > 0 ? post.tags.map((tag) => `  - ${tag}`).join("\n") : "  []"

  return [
    "---",
    `title: ${frontMatterValue(post.title)}`,
    `slug: ${frontMatterValue(post.slug)}`,
    `publicId: ${frontMatterValue(post.publicId)}`,
    `published: ${post.published}`,
    publishedAt ? `publishedAt: ${frontMatterValue(publishedAt)}` : undefined,
    "tags:",
    tags,
    "---",
    "",
    post.content,
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n")
}

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string") : []
  if (ids.length > 100) {
    return NextResponse.json({ error: "Selecione no máximo 100 posts por exportação." }, { status: 400 })
  }
  if (ids.some((id) => !ObjectId.isValid(id))) {
    return NextResponse.json({ error: "Lista contém IDs inválidos." }, { status: 400 })
  }

  const objectIds = ids.map((id) => new ObjectId(id))

  if (objectIds.length === 0) {
    return NextResponse.json({ error: "Nenhum post selecionado." }, { status: 400 })
  }

  const db = await getDb()
  const posts = await db
    .collection<Post>("posts")
    .find({ _id: { $in: objectIds } })
    .sort({ publishedAt: -1, createdAt: -1 })
    .toArray()

  const markdown = posts.map(postToMarkdown).join("\n\n---\n\n")

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="posts-${siteDateKey()}.md"`,
    },
  })
}
