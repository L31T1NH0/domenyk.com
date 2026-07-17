import { MongoClient } from "mongodb"
import { backupDatabase, backupPassphrase } from "./secure-mongo-backup.mjs"

const apply = process.argv.includes("--apply")
const backupArg = process.argv.find((argument) => argument.startsWith("--backup-dir="))?.slice("--backup-dir=".length)
const uri = process.env.MONGODB_URI
if (!uri) throw new Error("MONGODB_URI is not set")
if (apply && !backupArg) throw new Error("Use --backup-dir=/caminho/novo ao executar com --apply.")
const passphrase = apply ? backupPassphrase() : null

function plainDescription(markdown = "", maxLength = 155) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (text.length <= maxLength) return text
  const candidate = text.slice(0, maxLength + 1)
  return `${candidate.slice(0, candidate.lastIndexOf(" ") || maxLength).trim()}...`
}

function migrationSet(post) {
  const set = {}
  if (!("seoTitle" in post) && post.title) set.seoTitle = post.title
  if (!("seoDescription" in post)) {
    const value = post.excerpt ?? post.subtitle ?? plainDescription(post.content)
    if (value) set.seoDescription = value
  }

  for (const [locale, translation] of Object.entries(post.translations ?? {})) {
    if (!("seoTitle" in translation) && translation.title) set[`translations.${locale}.seoTitle`] = translation.title
    if (!("seoDescription" in translation)) {
      const value = translation.excerpt ?? translation.subtitle ?? plainDescription(translation.content)
      if (value) set[`translations.${locale}.seoDescription`] = value
    }
  }
  return set
}

const client = new MongoClient(uri)
try {
  await client.connect()
  const db = client.db("blog")
  const posts = await db.collection("posts").find({}).toArray()
  const operations = posts.flatMap((post) => {
    const $set = migrationSet(post)
    return Object.keys($set).length > 0 ? [{ updateOne: { filter: { _id: post._id }, update: { $set } } }] : []
  })

  const report = {
    mode: apply ? "apply" : "dry-run",
    posts: posts.length,
    postsToUpdate: operations.length,
    fieldsToAdd: operations.reduce((total, operation) => total + Object.keys(operation.updateOne.update.$set).length, 0),
  }

  if (!apply) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    const beforeCounts = Object.fromEntries(await Promise.all(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map(async ({ name }) => [name, await db.collection(name).countDocuments({})])
    ))
    const backup = await backupDatabase(db, backupArg, passphrase)
    const result = operations.length > 0 ? await db.collection("posts").bulkWrite(operations, { ordered: true }) : null
    const afterCounts = Object.fromEntries(await Promise.all(
      Object.keys(beforeCounts).map(async (name) => [name, await db.collection(name).countDocuments({})])
    ))
    if (JSON.stringify(beforeCounts) !== JSON.stringify(afterCounts)) {
      throw new Error("As contagens do banco mudaram durante a migração.")
    }

    const remaining = await db.collection("posts").find({}).toArray()
    const remainingChanges = remaining.filter((post) => Object.keys(migrationSet(post)).length > 0)
    if (remainingChanges.length > 0) throw new Error(`${remainingChanges.length} post(s) ainda exigem migração.`)

    console.log(JSON.stringify({
      ...report,
      backup: backup.target,
      backupCollections: backup.manifest.collections.length,
      matched: result?.matchedCount ?? 0,
      modified: result?.modifiedCount ?? 0,
      countsPreserved: true,
      idempotent: true,
    }, null, 2))
  }
} finally {
  await client.close()
}
