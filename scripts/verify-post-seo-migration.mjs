import { isDeepStrictEqual } from "node:util"
import { resolve } from "node:path"
import { EJSON } from "bson"
import { MongoClient } from "mongodb"
import { backupPassphrase, readEncryptedBackup } from "./secure-mongo-backup.mjs"

const backupDirectory = process.argv.find((argument) => argument.startsWith("--backup-dir="))?.slice("--backup-dir=".length)
const uri = process.env.MONGODB_URI
if (!backupDirectory) throw new Error("Use --backup-dir=/caminho/do/backup.")
if (!uri) throw new Error("MONGODB_URI is not set")
const passphrase = backupPassphrase()

const originalPosts = EJSON.parse(
  await readEncryptedBackup(resolve(backupDirectory, "posts.ejson.enc"), passphrase),
  { relaxed: false }
)
const client = new MongoClient(uri)
try {
  await client.connect()
  const currentPosts = await client.db("blog").collection("posts").find({}).toArray()
  const currentById = new Map(currentPosts.map((post) => [post._id.toString(), post]))
  const differences = []

  for (const original of originalPosts) {
    const current = currentById.get(original._id.toString())
    if (!current) {
      differences.push({ id: original._id.toString(), reason: "ausente" })
      continue
    }
    const comparable = EJSON.parse(EJSON.stringify(current, null, 0, { relaxed: false }), { relaxed: false })
    if (!Object.hasOwn(original, "seoTitle")) delete comparable.seoTitle
    if (!Object.hasOwn(original, "seoDescription")) delete comparable.seoDescription
    for (const [locale, translation] of Object.entries(original.translations ?? {})) {
      const comparableTranslation = comparable.translations?.[locale]
      if (!comparableTranslation) continue
      if (!Object.hasOwn(translation, "seoTitle")) delete comparableTranslation.seoTitle
      if (!Object.hasOwn(translation, "seoDescription")) delete comparableTranslation.seoDescription
    }
    if (!isDeepStrictEqual(original, comparable)) {
      differences.push({ id: original._id.toString(), reason: "conteúdo divergente fora dos novos campos" })
    }
  }

  console.log(JSON.stringify({
    backupPosts: originalPosts.length,
    currentPosts: currentPosts.length,
    postsUnchangedOutsideAddedFields: differences.length === 0,
    differences,
  }, null, 2))
  if (differences.length > 0 || originalPosts.length !== currentPosts.length) process.exitCode = 1
} finally {
  await client.close()
}
