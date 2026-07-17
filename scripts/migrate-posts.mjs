import { MongoClient } from "mongodb"
import { randomUUID } from "crypto"
import { backupDatabase, backupPassphrase } from "./secure-mongo-backup.mjs"

const URI = process.env.MONGODB_URI
if (!URI) throw new Error("MONGODB_URI não definida")
const apply = process.argv.includes("--apply")
const confirmed = process.argv.includes("--confirm=APLICAR-MIGRACAO-LEGADA")
const backupArg = process.argv.find((argument) => argument.startsWith("--backup-dir="))?.slice("--backup-dir=".length)
if (apply && !confirmed) throw new Error("Use --confirm=APLICAR-MIGRACAO-LEGADA junto com --apply.")
if (apply && !backupArg) throw new Error("Use --backup-dir=/caminho/fora/do/repositorio junto com --apply.")
const passphrase = apply ? backupPassphrase() : null

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

  const candidates = oldPosts.filter((post) => !(post.slug && !post.postId))
  const skipped = oldPosts.length - candidates.length
  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", found: oldPosts.length, candidates: candidates.length, skipped }, null, 2))
    await client.close()
    return
  }

  await backupDatabase(db, backupArg, passphrase)
  let migrated = 0

  for (const post of candidates) {

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

    const concurrencyFilter = Object.hasOwn(post, "postId")
      ? { _id: post._id, postId: post.postId }
      : { _id: post._id, postId: { $exists: false } }
    const result = await col.replaceOne(concurrencyFilter, newDoc)
    if (result.matchedCount !== 1) throw new Error(`O post ${post._id} mudou durante a migração.`)
    console.log(`  [ok] ${post.title}`)
    migrated++
  }

  console.log(`\nMigração concluída: ${migrated} migrados, ${skipped} ignorados`)
  await client.close()
}

main().catch(async (e) => { console.error(e); await client.close().catch(() => undefined); process.exit(1) })
