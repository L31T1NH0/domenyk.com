import { BSON, type CollectionInfo, type Document } from "mongodb"
import { adminOnly } from "@/lib/auth"
import { getDb } from "@/lib/db/client"
import { siteDateKey } from "@/lib/datetime"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const encoder = new TextEncoder()

function asExtendedJson(value: unknown): string {
  return BSON.EJSON.stringify(value, { relaxed: false })
}

async function indexesFor(info: CollectionInfo, db: Awaited<ReturnType<typeof getDb>>) {
  if (info.type !== "collection" && info.type !== "timeseries") return []

  return db.collection(info.name).listIndexes().toArray()
}

async function* createBackup() {
  const db = await getDb()
  const collections = await db.listCollections({}, { nameOnly: false }).toArray()

  yield `{"format":"domenyk-mongodb-backup","version":1,"database":${JSON.stringify(db.databaseName)},"exportedAt":${JSON.stringify(new Date().toISOString())},"collections":[`

  for (let collectionIndex = 0; collectionIndex < collections.length; collectionIndex += 1) {
    const info = collections[collectionIndex]
    const collectionType = info.type ?? "collection"
    const indexes = await indexesFor(info, db)
    const cursor = db.collection<Document>(info.name).find({})

    if (collectionIndex > 0) yield ","
    yield `{"name":${JSON.stringify(info.name)},"type":${JSON.stringify(collectionType)},"options":${asExtendedJson(info.options ?? {})},"indexes":${asExtendedJson(indexes)},"documents":[`

    let documentIndex = 0
    try {
      for await (const document of cursor) {
        if (documentIndex > 0) yield ","
        yield asExtendedJson(document)
        documentIndex += 1
      }
    } finally {
      await cursor.close()
    }

    yield "]}"
  }

  yield "]}"
}

function backupStream() {
  const chunks = createBackup()

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await chunks.next()
        if (next.done) {
          controller.close()
          return
        }
        controller.enqueue(encoder.encode(next.value))
      } catch (error) {
        controller.error(error)
      }
    },
    async cancel() {
      await chunks.return(undefined)
    },
  })
}

export async function POST() {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const compressor = new CompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>
  const compressed = backupStream().pipeThrough(compressor)

  return new Response(compressed, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="mongodb-completo-${siteDateKey()}.json.gz"`,
      "X-Content-Type-Options": "nosniff",
    },
  })
}
