import { MongoClient } from "mongodb"
import { backupDatabase, backupPassphrase } from "./secure-mongo-backup.mjs"
import { siteDateKeyToInstant } from "../src/lib/datetime.ts"

const uri = process.env.MONGODB_URI
if (!uri) throw new Error("MONGODB_URI não definida")

const apply = process.argv.includes("--apply")
const confirmed = process.argv.includes("--confirm=CORRIGIR-DATAS-LEGADAS")
const backupArg = process.argv.find((argument) => argument.startsWith("--backup-dir="))?.slice("--backup-dir=".length)

if (apply && !confirmed) throw new Error("Use --confirm=CORRIGIR-DATAS-LEGADAS junto com --apply.")
if (apply && !backupArg) throw new Error("Use --backup-dir=/caminho/fora/do/repositorio junto com --apply.")

const client = new MongoClient(uri)
const LEGACY_DATE_CUTOFF = new Date("2026-01-01T00:00:00.000Z")

function isUtcMidnight(date) {
  return date.getUTCHours() === 0
    && date.getUTCMinutes() === 0
    && date.getUTCSeconds() === 0
    && date.getUTCMilliseconds() === 0
}

function correctedInstant(date) {
  return siteDateKeyToInstant(date.toISOString().slice(0, 10))
}

async function main() {
  await client.connect()
  const db = client.db("blog")
  const posts = db.collection("posts")
  const rows = await posts.find(
    { publishedAt: { $type: "date" }, createdAt: { $type: "date" } },
    { projection: { title: 1, publishedAt: 1, createdAt: 1 } }
  ).toArray()

  const candidates = rows
    .filter((post) => (
      post.publishedAt < LEGACY_DATE_CUTOFF
      && post.publishedAt.getTime() === post.createdAt.getTime()
      && isUtcMidnight(post.publishedAt)
    ))
    .map((post) => ({
      ...post,
      correctedPublishedAt: correctedInstant(post.publishedAt),
      correctedCreatedAt: correctedInstant(post.createdAt),
    }))

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    inspected: rows.length,
    candidates: candidates.length,
    posts: candidates.map((post) => ({
      id: post._id.toString(),
      title: post.title,
      publishedAt: { from: post.publishedAt.toISOString(), to: post.correctedPublishedAt.toISOString() },
      createdAt: { from: post.createdAt.toISOString(), to: post.correctedCreatedAt.toISOString() },
    })),
  }, null, 2))

  if (!apply || candidates.length === 0) return

  const passphrase = backupPassphrase()
  const backup = await backupDatabase(db, backupArg, passphrase)
  const result = await posts.bulkWrite(candidates.map((post) => ({
    updateOne: {
      filter: { _id: post._id, publishedAt: post.publishedAt, createdAt: post.createdAt },
      update: { $set: { publishedAt: post.correctedPublishedAt, createdAt: post.correctedCreatedAt } },
    },
  })), { ordered: true })

  if (result.matchedCount !== candidates.length || result.modifiedCount !== candidates.length) {
    throw new Error(`Concorrência detectada: ${result.matchedCount} encontrados e ${result.modifiedCount} corrigidos de ${candidates.length}.`)
  }
  console.log(JSON.stringify({ corrected: result.modifiedCount, encryptedBackup: backup.target }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => client.close())
