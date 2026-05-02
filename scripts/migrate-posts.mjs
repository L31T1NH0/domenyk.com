import { MongoClient } from "mongodb"
import { randomUUID } from "crypto"

const URI = process.env.MONGODB_URI
if (!URI) throw new Error("MONGODB_URI não definida")

const client = new MongoClient(URI)

function calcReadingTime(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  const words = text.split(" ").length
  return Math.max(1, Math.round(words / 200))
}

function extractExcerpt(html) {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
  if (!match) return undefined
  return match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)
}

async function main() {
  await client.connect()
  const db = client.db("blog")
  const col = db.collection("posts")

  const oldPosts = await col.find({}).toArray()
  console.log(`Encontrados ${oldPosts.length} posts`)

  let migrated = 0
  let skipped = 0

  for (const post of oldPosts) {
    // Já tem o novo schema se tiver `slug` e não tiver `postId`
    if (post.slug && !post.postId) {
      console.log(`  [skip] ${post.title} — já migrado`)
      skipped++
      continue
    }

    const slug = post.postId ?? post._id.toString()
    const content = post.contentMarkdown ?? post.htmlContent ?? post.content ?? ""
    const publishedAt = post.date ? new Date(post.date) : new Date()

    const newDoc = {
      publicId: post.publicId ?? randomUUID(),
      slug,
      title: post.title ?? "",
      content,
      excerpt: extractExcerpt(content),
      cover: post.cape ? { url: post.cape } : undefined,
      audioUrl: typeof post.audioUrl === "string" && post.audioUrl.trim() ? post.audioUrl.trim() : undefined,
      background: undefined,
      tags: post.tags ?? [],
      pinned: post.pinnedOrder != null,
      published: post.hidden !== true,
      publishedAt,
      readingTimeMinutes: calcReadingTime(content),
      style: "standard",
      createdAt: publishedAt,
      updatedAt: publishedAt,
    }

    await col.replaceOne({ _id: post._id }, newDoc)
    console.log(`  [ok] ${post.title}`)
    migrated++
  }

  console.log(`\nMigração concluída: ${migrated} migrados, ${skipped} ignorados`)
  await client.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
